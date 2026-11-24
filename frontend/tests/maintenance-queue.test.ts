import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Pallet} from '../../backend/shared/types';
import {getMaintenanceQueues, remainingCycles, waitingTime} from '../src/lib/maintenanceQueue';
import {parseSavedReportFilters} from '../src/components/SavedReportFilters';

test('the service queue sorts oldest status first and prioritizes pallets closest to washing', () => {
    const pallet = (id: number, status: Pallet['status'], cycles: number, status_changed_at?: string) =>
        ({id, pallet_id: String(id), status, current_cycles: cycles, max_cycles: 100, status_changed_at}) as Pallet;
    const oldest = pallet(4, 'Washing_Required', 100, '2026-11-24T05:00:00Z');
    const newer = pallet(1, 'Damaged', 2, '2026-11-24T07:00:00Z');
    const unknown = pallet(2, 'Damaged', 2);
    const soon = pallet(5, 'Active', 80);
    const urgent = pallet(6, 'Active', 99);
    const beforeThreshold = pallet(7, 'Active', 79);
    assert.deepEqual(getMaintenanceQueues([newer, unknown, soon, oldest, urgent, beforeThreshold]), {
        queue: [oldest, newer, unknown], repairs: [newer, unknown], routine: [oldest], soon: [urgent, soon],
    });
    assert.equal(remainingCycles(urgent), 1);
    assert.equal(waitingTime(oldest, Date.parse('2026-11-24T08:00:00Z'), 'en'), '3 hr');
    assert.equal(waitingTime(unknown, Date.now(), 'en'), undefined);
});

test('saved report filters read valid names and tolerate invalid browser storage', () => {
    const filter = {name: 'Wash', query: 'previous=Washing_Required&status=Active'};
    assert.deepEqual(parseSavedReportFilters(JSON.stringify([null, filter, {name: '', query: 'status=Active'}])), [filter]);
    assert.deepEqual(parseSavedReportFilters('{invalid'), []);
});
