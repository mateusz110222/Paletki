import assert from 'node:assert/strict';
import {test} from 'node:test';
import {filterPallets, matchesPalletSearch} from '../src/lib/palletSearch';
import type {Pallet} from '@backend/shared/types';
import {getCatalogAdminUrl} from '../src/lib/catalog';

test('search matches full model names, spaces and existing inventory fields', () => {
    const pallet = {pallet_id: 'ETC32016', model: 'ETC 3.2', project: 'DAF', created_by: 'Operator'};
    for (const query of ['ETC', 'ETC 3.2', ' etc  3.2 ', 'DAF', 'operator', 'ETC32016', '']) {
        assert.equal(matchesPalletSearch(pallet, query), true, query);
    }
    assert.equal(matchesPalletSearch(pallet, 'ETC 3.3'), false);
});

test('FIS filtering combines with project, model, status, machine and search', () => {
    const base = {project: 'AUDI', model: 'Board', status: 'Active', machine: 'COAT', fis: 2};
    const pallets = [
        {...base, pallet_id: 'PAL-1', fis: 1},
        {...base, pallet_id: 'PAL-2'},
        {...base, pallet_id: 'PAL-3', machine: 'WSM'},
        {...base, pallet_id: 'PAL-4', project: 'Other'},
        {...base, pallet_id: 'PAL-5', model: 'Other'},
        {...base, pallet_id: 'PAL-6', status: 'Damaged'},
        {...base, pallet_id: 'OTHER-7'},
    ] as Pallet[];
    const all = {search: '', project: 'ALL', model: 'ALL', status: 'ALL', machine: 'ALL', fis: 'ALL'};
    assert.deepEqual(filterPallets(pallets, all), pallets);
    assert.deepEqual(filterPallets(pallets, {...all, fis: '1'}).map(p => p.pallet_id), ['PAL-1']);
    assert.equal(filterPallets(pallets, {...all, fis: '2'}).length, 6);
    const combined = {search: 'pal-', project: 'AUDI', model: 'Board', status: 'Active', machine: 'COAT', fis: '2'};
    assert.deepEqual(filterPallets(pallets, combined).map(p => p.pallet_id), ['PAL-2']);
    assert.deepEqual(filterPallets(pallets, {...combined, fis: 'ALL'}).map(p => p.pallet_id), ['PAL-1', 'PAL-2']);
});

test('catalog links encode exact project and model filters without stale search parameters', () => {
    const project = new URL(getCatalogAdminUrl({id: 1, kind: 'project', name: 'AUDI'}), 'https://local.test');
    assert.equal(project.pathname, '/admin');
    assert.deepEqual([...project.searchParams], [['project', 'AUDI']]);
    const model = new URL(getCatalogAdminUrl({id: 2, kind: 'model', name: 'ETC 3.2 / A&B', project: 'AUDI PPE'}), 'https://local.test');
    assert.deepEqual([...model.searchParams], [['project', 'AUDI PPE'], ['model', 'ETC 3.2 / A&B']]);
});
