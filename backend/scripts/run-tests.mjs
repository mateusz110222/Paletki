import {spawnSync} from 'node:child_process';
import process from 'node:process';
import {fileURLToPath, URL} from 'node:url';

const vitestPath = fileURLToPath(new URL('../../node_modules/vitest/vitest.mjs', import.meta.url));
const args = ['run', '--passWithNoTests'];

if (process.env.PALETKI_INTEGRATION_TESTS === '1') {
    args.push('pallet/database.integration.test.ts');
} else {
    args.push('--exclude', '**/*.integration.test.ts');
}

const result = spawnSync(process.execPath, [vitestPath, ...args], {stdio: 'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
