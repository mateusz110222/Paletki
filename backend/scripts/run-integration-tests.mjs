import {spawnSync} from 'node:child_process';
import process from 'node:process';

const command = process.platform === 'win32' ? 'encore.exe' : 'encore';
const result = spawnSync(command, ['test', '--no-color'], {
    env: {...process.env, PALETKI_INTEGRATION_TESTS: '1', FIS_OUTBOX_WORKER_TOKEN: 'fixture-worker-token'},
    stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
