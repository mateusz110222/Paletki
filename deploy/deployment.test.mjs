import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {test} from 'node:test';

// js-yaml is already installed by ESLint in this workspace.
const {load} = createRequire(import.meta.url)('js-yaml');
const root = new URL('../', import.meta.url);
const compose = load(readFileSync(new URL('compose.production.yml', root), 'utf8'));
const workflow = load(readFileSync(new URL('.github/workflows/ci-cd.yml', root), 'utf8'));

test('production packages assets and requires the existing database volume', () => {
    assert.equal(compose.volumes.pgdata.external, true);
    assert.match(compose.volumes.pgdata.name, /POSTGRES_VOLUME:\?/);
    assert.equal(compose.services['db-migrations'].volumes, undefined);
    assert.equal(compose.services.frontend.volumes, undefined);
    assert.equal(compose.services.backend.volumes.length, 1);
    assert.equal(compose.services.backend.volumes[0].bind.create_host_path, false);
    assert.equal(compose.services.backend.environment.ENCORE_ENV, 'production');
    assert.equal(compose.services.backend.depends_on['db-migrations'].condition, 'service_completed_successfully');
});

test('pull requests never reach publishing or the production runner', () => {
    assert.equal(workflow.jobs.verify['runs-on'], 'ubuntu-latest');
    assert.match(workflow.jobs.publish.if, /github.event_name != 'pull_request'/);
    assert.match(workflow.jobs.publish.if, /refs\/heads\/master/);
    assert.equal(workflow.jobs.deploy.needs, 'publish');
    assert.equal(workflow.jobs.deploy.environment, 'production');
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
});

test('deployment backs up before migration and never starts the app after a migration failure', {
    skip: process.platform === 'win32' ? 'Deployment runs on Linux' : false,
}, () => {
    const directory = mkdtempSync(join(tmpdir(), 'paletki-deploy-'));
    try {
        const bin = join(directory, 'bin');
        mkdirSync(bin);
        writeFileSync(join(directory, '.env.production'), 'COMPOSE_PROJECT_NAME=test\n');
        writeFileSync(join(directory, 'ca.pem'), 'test certificate');
        writeFileSync(join(bin, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DOCKER_CALL_LOG, JSON.stringify(args) + '\\n');
if (args.includes('--environment')) process.stdout.write('LDAP_CA_CERT_HOST_PATH=' + process.env.TEST_CERT_PATH + '\\nPOSTGRES_VOLUME=test_pgdata\\n');
if (args.includes('pg_dump')) process.stdout.write('test backup');
if (process.env.FAIL_MIGRATION && args.includes('--exit-code-from')) process.exit(7);
`, {mode: 0o755});
        const log = join(directory, 'calls.jsonl');
        const env = {...process.env, PATH: `${bin}:${process.env.PATH}`,
            PALETKI_DEPLOY_DIR: directory, DOCKER_CALL_LOG: log, TEST_CERT_PATH: join(directory, 'ca.pem'),
            BACKEND_IMAGE: 'backend:test', FRONTEND_IMAGE: 'frontend:test', MIGRATIONS_IMAGE: 'migrations:test'};
        const run = (extra = {}) => spawnSync('bash', [new URL('deploy/deploy.sh', root).pathname], {
            env: {...env, ...extra}, encoding: 'utf8',
        });
        const calls = () => readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        const success = run();
        assert.equal(success.status, 0, success.stderr);
        const commands = calls();
        const index = value => commands.findIndex(args => args.includes(value));
        assert.ok(index('pull') < index('stop'));
        assert.ok(index('stop') < index('pg_dump'));
        assert.ok(index('pg_dump') < index('--exit-code-from'));
        assert.ok(index('--exit-code-from') < index('wget'));
        const savedRelease = readFileSync(join(directory, 'release.production.env'), 'utf8');
        writeFileSync(log, '');
        const failed = run({FAIL_MIGRATION: '1', BACKEND_IMAGE: 'backend:failed'});
        assert.equal(failed.status, 7);
        assert.ok(!calls().some(args => args.includes('--wait-timeout') && args.includes('180')));
        assert.equal(readFileSync(join(directory, 'release.production.env'), 'utf8'), savedRelease);
        writeFileSync(log, '');
        const missingCertificate = run({TEST_CERT_PATH: join(directory, 'missing.pem')});
        assert.notEqual(missingCertificate.status, 0);
        assert.ok(!calls().some(args => args.includes('stop')));
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
});
