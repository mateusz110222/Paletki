import assert from 'node:assert/strict';
import {test} from 'node:test';
import {matchesPalletSearch} from '../src/lib/palletSearch';
import {getCatalogAdminUrl} from '../src/lib/catalog';

test('search matches full model names, spaces and existing inventory fields', () => {
    const pallet = {pallet_id: 'ETC32016', model: 'ETC 3.2', project: 'DAF', created_by: 'Operator'};
    for (const query of ['ETC', 'ETC 3.2', ' etc  3.2 ', 'DAF', 'operator', 'ETC32016', '']) {
        assert.equal(matchesPalletSearch(pallet, query), true, query);
    }
    assert.equal(matchesPalletSearch(pallet, 'ETC 3.3'), false);
});

test('catalog links encode exact project and model filters without stale search parameters', () => {
    const project = new URL(getCatalogAdminUrl({id: 1, kind: 'project', name: 'AUDI'}), 'https://local.test');
    assert.equal(project.pathname, '/admin');
    assert.deepEqual([...project.searchParams], [['project', 'AUDI']]);
    const model = new URL(getCatalogAdminUrl({id: 2, kind: 'model', name: 'ETC 3.2 / A&B', project: 'AUDI PPE'}), 'https://local.test');
    assert.deepEqual([...model.searchParams], [['project', 'AUDI PPE'], ['model', 'ETC 3.2 / A&B']]);
});
