import assert from 'node:assert/strict';
import {test} from 'node:test';
import Client from '../src/lib/client';

test('API transport sends machine on single, range and edit and requires unblock comment in its payload', async () => {
    const requests: {url: string; body: Record<string, unknown>}[] = [];
    const client = new Client('http://qa.test', {fetcher: async (input, init) => {
        requests.push({url: String(input), body: JSON.parse(String(init?.body ?? '{}'))});
        return new Response(JSON.stringify({status: true, pallet_id: 'PAL-01'}), {headers: {'Content-Type': 'application/json'}});
    }});
    const details = {project: 'Project', model: 'Model', machine: 'COAT' as const, max_cycles: 100, nests: 1, fis: 1 as const, status: 'Active' as const};
    await client.pallet.AddPallet({...details, pallet_id: 'PAL-01'});
    await client.pallet.AddPalletRange({...details, first_pallet_id: 'PAL-02', last_pallet_id: 'PAL-03'});
    await client.pallet.UpdatePallet('PAL-01', {machine: 'SSM'});
    await client.pallet.UnblockPallet({pallet_id: 'PAL-01', comment: 'Checked'});
    assert.deepEqual(requests.map(request => request.body.machine), ['COAT', 'COAT', 'SSM', undefined]);
    assert.equal(requests[3].body.comment, 'Checked');
});

test('report transport separates query filters from headers and sends the edit version', async () => {
    const requests: {url: string; init?: RequestInit}[] = [];
    const client = new Client('http://qa.test', {fetcher: async (input, init) => {
        requests.push({url: String(input), init}); return new Response(JSON.stringify({rows: [], reports: []}));
    }});
    await client.pallet.GetReports({mode: 'history', from: '2026-10-01', to: '2026-10-12', statuses: 'Damaged,Blocked', offset: 200, limit: 200, acceptLanguage: 'pl'});
    const url = new URL(requests[0].url);
    assert.equal(url.pathname, '/pallets/reports');
    assert.equal(url.searchParams.get('offset'), '200');
    assert.equal(url.searchParams.get('statuses'), 'Damaged,Blocked');
    assert.equal(url.searchParams.get('acceptLanguage'), null);
    assert.equal(new Headers(requests[0].init?.headers).get('accept-language'), 'pl');
    await client.pallet.EditOperatorReport(123, {pallet_id: 'PAL-01', version: 4, defect_id: null, description: 'Corrected'});
    assert.equal(new URL(requests[1].url).pathname, '/operator-reports/123');
    assert.equal(JSON.parse(String(requests[1].init?.body)).version, 4);
});

test('washing confirmation sends the scanned cycle count and a separate optional comment', async () => {
    let request: {url: string; init?: RequestInit} | undefined;
    const client = new Client('http://qa.test', {fetcher: async (input, init) => {
        request = {url: String(input), init}; return new Response(JSON.stringify({pallet: {}, reset: true}));
    }});
    await client.pallet.ConfirmPalletWashing({pallet_id: 'PAL-01', expected_cycles: 40, expected_updated_at: '2026-10-13T10:00:00.000Z', comment: 'Early wash', acceptLanguage: 'pl'});
    assert.equal(new URL(request!.url).pathname, '/pallets/confirm-washing');
    assert.deepEqual(JSON.parse(String(request!.init?.body)), {pallet_id: 'PAL-01', expected_cycles: 40, expected_updated_at: '2026-10-13T10:00:00.000Z', comment: 'Early wash'});
    assert.equal(new Headers(request!.init?.headers).get('accept-language'), 'pl');
});
