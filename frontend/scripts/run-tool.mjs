import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Resolve from this workspace so hoisted packages and Windows' stale .bin shims
// cannot select the wrong executable (notably Vite and frontend ESLint 9).
const [tool, ...args] = process.argv.slice(2);
if (!['vite', 'eslint', 'tsx'].includes(tool)) throw new Error(`Unsupported frontend tool: ${tool}`);
const require = createRequire(import.meta.url);
const packagePath = require.resolve(`${tool}/package.json`);
const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
const entry = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[tool];
const executable = resolve(dirname(packagePath), entry);
process.argv = [process.execPath, executable, ...args];
await import(pathToFileURL(executable).href);
