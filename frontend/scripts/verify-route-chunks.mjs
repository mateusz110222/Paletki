import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'));
function staticDependencies(key, visited = new Set()) {
    if (visited.has(key)) return visited;
    visited.add(key);
    for (const imported of manifest[key]?.imports ?? []) staticDependencies(imported, visited);
    return visited;
}
const entry = Object.keys(manifest).find(key => manifest[key].isEntry);
assert.ok(entry, 'Missing application entry');
const eager = staticDependencies(entry);
const areas = ['operator', 'maintenance', 'dashboards', 'admin'];
const keys = {};
for (const name of areas) {
    const key = Object.keys(manifest).find(key => manifest[key].name === name);
    assert.ok(key && manifest[key].isDynamicEntry, `${name} must have a lazy area entry`);
    assert.ok(!eager.has(key), `${name} must not load with the application shell`);
    keys[name] = key;
}
for (const area of areas) {
    const dependencies = staticDependencies(keys[area]);
    for (const other of areas.filter(name => name !== area)) {
        assert.ok(!dependencies.has(keys[other]), `${area} must not preload ${other}`);
    }
}
const viewEntries = Object.keys(manifest).filter(key => manifest[key].isDynamicEntry && /views\//.test(key));
assert.deepEqual(viewEntries.map(key => manifest[key].name), ['DocumentationView'], 'Area screens must not be separate lazy entries');
const workbook = Object.keys(manifest).find(key => manifest[key].name === 'reportWorkbook');
const reports = keys.maintenance;
assert.ok(workbook && manifest[workbook].isDynamicEntry && !eager.has(workbook));
assert.ok(!staticDependencies(reports).has(workbook), 'XLSX must load only on export');
console.log('Verified four isolated area bundles (operator, maintenance, dashboards, admin), and on-demand XLSX.');
