import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadPalletPages} from '../src/lib/palletPages';

test('loads all API pages, including records beyond the sixth UI page', async () => {
    const records = Array.from({length: 1296}, (_, index) => ({id: index * 2 + 1}));
    let requests = 0;
    const result = await loadPalletPages(async afterId => {
        requests++;
        const remaining = records.filter(record => record.id > (afterId ?? 0));
        const pallets = remaining.slice(0, 200);
        return {pallets, next_cursor: remaining.length > 200 ? pallets.at(-1)!.id : undefined};
    });
    assert.equal(requests, 7);
    assert.deepEqual(result, records);
    assert.equal(Math.ceil(result.length / 50), 26);
    assert.equal(result.slice(1250).length, 46);
});

test('continues after a short page if the API supplies a cursor', async () => {
    const result = await loadPalletPages(async afterId => afterId === undefined
        ? {pallets: [1], next_cursor: 1}
        : {pallets: [2], next_cursor: null});
    assert.deepEqual(result, [1, 2]);
});

test('reports invalid cursors instead of looping or publishing a partial inventory', async () => {
    await assert.rejects(loadPalletPages(async () => ({pallets: [1], next_cursor: 1})), /cursor/);
});
