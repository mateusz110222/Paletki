import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// This runner only creates and removes its own disposable test container.
const name = `palletx-test-${randomUUID().slice(0, 8)}`;
function docker(...args) {
    const result = spawnSync('docker', args, {encoding: 'utf8'});
    if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Docker failed');
    return result.stdout.trim();
}
let created = false;
try {
    docker('run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=palletx-test', '-e', 'POSTGRES_DB=palletx_test',
        '-p', '127.0.0.1::5432', 'postgres:18.6-alpine');
    created = true;
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
        const check = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], {encoding: 'utf8'});
        if (check.status === 0) {ready = true; break;}
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('Test PostgreSQL did not become ready');
    const port = docker('port', name, '5432/tcp').split(':').at(-1);
    const vitest = fileURLToPath(new URL('../../node_modules/vitest/vitest.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [vitest, 'run', 'pallet/operator-reports.postgres.integration.test.ts'], {
        stdio: 'inherit', env: {...process.env, PALLETX_TEST_DATABASE: `postgres://postgres:palletx-test@127.0.0.1:${port}/palletx_test`},
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} finally {
    if (created) docker('rm', '-f', name);
}
