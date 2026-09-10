import assert from 'node:assert/strict';
import test from 'node:test';
import type {Pallet} from '@backend/shared/types';
import {parseTableSort, sortPallets} from '../src/lib/tablePreferences';

test('date sorting compares timestamps across time zones and keeps missing dates last', () => {
    const pallets = [
        {pallet_id: 'A', created_at: '2026-09-10T10:00:00+02:00'},
        {pallet_id: 'B', created_at: '2026-09-10T09:00:00Z'},
        {pallet_id: 'C', created_at: ''},
    ] as Pallet[];
    assert.deepEqual(sortPallets(pallets, {key: 'created_at', direction: 'desc'}, 'pl').map(p => p.pallet_id), ['B', 'A', 'C']);
    assert.deepEqual(sortPallets(pallets, {key: 'created_at', direction: 'asc'}, 'pl').map(p => p.pallet_id), ['A', 'B', 'C']);
    assert.deepEqual(parseTableSort('{"key":"created_at","direction":"desc"}'), {key: 'created_at', direction: 'desc'});
});

test('invalid stored sorting cannot select arbitrary properties', () => {
    for (const raw of [null, '{', '{}', '{"key":"__proto__","direction":"asc"}', '{"key":"status","direction":"sideways"}']) {
        assert.deepEqual(parseTableSort(raw), {key:'pallet_id', direction:'asc'});
    }
    assert.deepEqual(parseTableSort('{"key":"current_cycles","direction":"desc"}'), {key:'current_cycles',direction:'desc'});
});
test('sorting compares numeric cycles and natural IDs without mutating cached pallets', () => {
    const pallets = [{pallet_id:'P10',current_cycles:10},{pallet_id:'P2',current_cycles:2},{pallet_id:'P1',current_cycles:2}] as Pallet[];
    assert.deepEqual(sortPallets(pallets, {key:'current_cycles',direction:'desc'}, 'pl').map(p=>p.pallet_id), ['P10','P1','P2']);
    assert.deepEqual(sortPallets(pallets, {key:'pallet_id',direction:'asc'}, 'pl').map(p=>p.pallet_id), ['P1','P2','P10']);
    assert.deepEqual(pallets.map(p=>p.pallet_id), ['P10','P2','P1']);
});
