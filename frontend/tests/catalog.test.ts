import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getCatalogEntries} from '../src/lib/catalog';

const projects = [{id: 1, name: 'AUDI'}, {id: 2, name: 'AUDI PPE'}, {id: 3, name: 'EMPTY'}];
const models = [
    {id: 10, name: 'SENSOR', project_id: 1},
    {id: 20, name: 'C4', project_id: 2},
    {id: 21, name: 'CONTROL BOARD', project_id: 2},
];

test('project drill-down uses its ID rather than a shared name prefix', () => {
    assert.deepEqual(getCatalogEntries(projects, models, 'model', '', 1).map(entry => entry.id), [10]);
    assert.deepEqual(getCatalogEntries(projects, models, 'model', '', 2).map(entry => entry.id), [20, 21]);
    assert.deepEqual(getCatalogEntries(projects, models, 'model', '', 3), []);
});

test('search stays within the selected project and clearing the scope restores all models', () => {
    assert.deepEqual(getCatalogEntries(projects, models, 'model', 'C4', 1), []);
    assert.equal(getCatalogEntries(projects, models, 'model', ' sensor ', 1).length, 1);
    assert.equal(getCatalogEntries(projects, models, 'model', 'audi', null).length, 3);
});

test('renaming a project does not change the models selected by ID', () => {
    const renamed = projects.map(project => ({...project, name: 'AUDI PPE'}));
    assert.deepEqual(getCatalogEntries(renamed, models, 'model', '', 1).map(entry => entry.id), [10]);
});
