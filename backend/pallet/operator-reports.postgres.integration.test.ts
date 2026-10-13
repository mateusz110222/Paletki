import {beforeAll, beforeEach, afterAll, describe, expect, it, vi} from 'vitest';
import {Pool, type PoolClient} from 'pg';
import {readFileSync, readdirSync} from 'node:fs';
import type {AuthData} from '../shared/auth-data';

const state = vi.hoisted(() => ({pool: null as Pool | null, auth: null as AuthData | null}));
vi.mock('~encore/auth', () => ({getAuthData: () => state.auth}));
vi.mock('../config', () => ({config: {fis: {requestTimeoutMs: 1000}}}));
vi.mock('encore.dev/api', () => {
    class TestAPIError extends Error {
        static invalidArgument(message: string) {return new TestAPIError(message);}
        static permissionDenied(message: string) {return new TestAPIError(message);}
        static notFound(message: string) {return new TestAPIError(message);}
        static alreadyExists(message: string) {return new TestAPIError(message);}
        static unauthenticated(message: string) {return new TestAPIError(message);}
        static failedPrecondition(message: string) {return new TestAPIError(message);}
        static aborted(message: string) {return new TestAPIError(message);}
        static internal(message: string) {return new TestAPIError(message);}
    }
    return {api: (_options: unknown, handler: unknown) => handler, APIError: TestAPIError};
});
vi.mock('./db', () => {
    function adapter(client: Pool | PoolClient) {
        const run = (parts: TemplateStringsArray, values: unknown[]) => client.query(parts.map((part, index) => part + (index < values.length ? `$${index + 1}` : '')).join(''), values);
        return {
            queryAll: async (parts: TemplateStringsArray, ...values: unknown[]) => (await run(parts, values)).rows,
            queryRow: async (parts: TemplateStringsArray, ...values: unknown[]) => (await run(parts, values)).rows[0] ?? null,
            exec: async (parts: TemplateStringsArray, ...values: unknown[]) => {await run(parts, values);},
        };
    }
    return {db: {
        queryAll: async (parts: TemplateStringsArray, ...values: unknown[]) => adapter(state.pool!).queryAll(parts, ...values),
        queryRow: async (parts: TemplateStringsArray, ...values: unknown[]) => adapter(state.pool!).queryRow(parts, ...values),
        begin: async () => {
            const client = await state.pool!.connect();
            await client.query('BEGIN');
            let finished = false;
            return {...adapter(client), commit: async () => {await client.query('COMMIT'); finished = true;},
                [Symbol.asyncDispose]: async () => {if (!finished) await client.query('ROLLBACK'); client.release();}};
        },
    }};
});
// Real SQL and real business handlers; only Encore's transport/runtime boundary is replaced.
import {AddDefect, DeleteDefect, UpdateDefect, CreateOperatorReport, EditOperatorReport, GetOperatorReports} from './operator-reports';
import {GetReports} from './reports';
import {ChangePalletStatus, BlockPallet, UnblockPallet} from './status';
import {AddPallet, AddPalletRange, UpdatePallet, GetPalletHistory, GetAllPalletHistory} from './pallet';
import {ConfirmPalletWashing} from './washing';
import {GetPublicDashboard} from './dashboard';
import {localizeAuditLog} from './audit-description';

const operator: AuthData = {fullName: 'Operator A', hasITDepartmentAccess: false, hasURDepartmentAccess: false, hasMEDepartmentAccess: false} as AuthData;
const ur: AuthData = {...operator, fullName: 'UR A', hasURDepartmentAccess: true};
const itUser: AuthData = {...operator, fullName: 'IT A', hasITDepartmentAccess: true};
async function confirmWashing(params: {pallet_id: string; expected_cycles: number; comment?: string; expected_updated_at?: string}) {
    const row = (await state.pool!.query('SELECT updated_at FROM pallets WHERE pallet_id=$1', [params.pallet_id])).rows[0];
    return ConfirmPalletWashing({...params, expected_updated_at: params.expected_updated_at ?? row.updated_at.toISOString()});
}
const suite = process.env.PALLETX_TEST_DATABASE ? describe : describe.skip;
suite('operator reports and reporting against isolated PostgreSQL', () => {
    beforeAll(async () => {
        // The runner supplies a dedicated temporary DB, never the application's database.
        state.pool = new Pool({connectionString: process.env.PALLETX_TEST_DATABASE});
        let legacyTimestamp: string | undefined;
        for (const file of readdirSync(new URL('./migrations/', import.meta.url)).filter(name => name.endsWith('.up.sql')).sort((a, b) => parseInt(a) - parseInt(b))) {
            if (file.startsWith('8_')) {
                await state.pool.query(`INSERT INTO projects(id,name) VALUES(900,'Legacy');
                    INSERT INTO pallet_models(id,project_id,name) VALUES(900,900,'Legacy');
                    INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,current_cycles,nests,status,created_by)
                    VALUES('LEGACY-RELEASE',900,900,100,100,1,'Blocked','Legacy IT');
                    UPDATE pallets SET status='Active',updated_by='Legacy IT',last_operation_description='i18n:{"key":"audit_unblocked","comment":"Legacy release comment"}' WHERE pallet_id='LEGACY-RELEASE';
                    UPDATE pallet_audit_logs SET timestamp=NOW()-interval '2 hours' WHERE pallet_id='LEGACY-RELEASE' AND new_status='Washing_Required'`);
                legacyTimestamp = (await state.pool.query("SELECT timestamp FROM pallet_audit_logs WHERE pallet_id='LEGACY-RELEASE' AND new_status='Washing_Required'")).rows[0].timestamp.toISOString();
            }
            await state.pool.query(readFileSync(new URL(`./migrations/${file}`, import.meta.url), 'utf8'));
        }
        const legacy = (await state.pool.query("SELECT * FROM pallet_audit_logs WHERE pallet_id='LEGACY-RELEASE' AND new_status='Washing_Required'")).rows[0];
        expect(legacy.description).toContain('Legacy release comment');
        expect(legacy.description).not.toContain('audit_unblocked_cycle_limit');
        expect(legacy.operator_id).toBe('Legacy IT');
        expect(legacy.timestamp.toISOString()).toBe(legacyTimestamp);
        expect((await state.pool.query("SELECT status_changed_at FROM pallets WHERE pallet_id='LEGACY-RELEASE'")).rows[0].status_changed_at.toISOString()).toBe(legacyTimestamp);
        expect((await state.pool.query("SELECT started_at FROM pallet_service_periods WHERE pallet_id='LEGACY-RELEASE' AND finished_at IS NULL")).rows[0].started_at.toISOString()).toBe(legacyTimestamp);
    });
    beforeEach(async () => {
        state.auth = ur;
        await state.pool!.query('TRUNCATE fis_outbox, operator_reports, defects, pallet_audit_logs, pallets, pallet_models, projects CASCADE');
        await state.pool!.query("INSERT INTO projects(id,name) VALUES(1,'Project'); INSERT INTO pallet_models(id,project_id,name) VALUES(1,1,'Model'); INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by) VALUES('PAL-01',1,1,100,1,'IT A')");
    });
    afterAll(async () => {await state.pool?.end();});
    it('allows UR to read individual pallet history but keeps bulk audit restricted', async () => {
        state.auth = operator;
        await expect(GetPalletHistory({pallet_id: 'PAL-01'})).rejects.toThrow();
        state.auth = ur;
        const history = await GetPalletHistory({pallet_id: 'PAL-01'});
        expect(history.history.length).toBeGreaterThan(0);
        await expect(GetAllPalletHistory({})).rejects.toThrow();
    });
    it('allows washing reports without operator comments', async () => {
        state.auth = operator;
        const report = await CreateOperatorReport({pallet_id: 'PAL-01', kind: 'washing'});
        expect(report.description).toBe('');
        expect((await state.pool!.query("SELECT status FROM pallets WHERE pallet_id='PAL-01'")).rows[0].status).toBe('Washing_Required');
    });
    it('requires descriptions only for Other and preserves report names after catalog rename/deletion', async () => {
        const defect = await AddDefect({name: 'Broken nest'});
        state.auth = operator;
        await expect(CreateOperatorReport({pallet_id: 'PAL-01', defect_id: null})).rejects.toThrow();
        const report = await CreateOperatorReport({pallet_id: 'PAL-01', defect_id: defect.id});
        expect(report.description).toBe('');
        state.auth = ur;
        await UpdateDefect({id: defect.id, name: 'Renamed'});
        expect((await GetOperatorReports({pallet_id: 'PAL-01'})).reports[0].defect_name).toBe('Broken nest');
        await DeleteDefect({id: defect.id});
        const saved = (await GetOperatorReports({pallet_id: 'PAL-01'})).reports[0];
        expect(saved.defect_id).toBeNull(); expect(saved.defect_name).toBe('Broken nest');
    });
    it('replaces report and history in place, retains original attribution and rejects stale edits', async () => {
        state.auth = operator;
        const report = await CreateOperatorReport({pallet_id: 'PAL-01', description: 'Old text'});
        const count = (await state.pool!.query('SELECT count(*) FROM pallet_audit_logs')).rows[0].count;
        await expect(EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 1, description: 'Unauthorized'})).rejects.toThrow();
        state.auth = ur;
        const edited = await EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 1, defect_id: null, description: 'Corrected text'});
        expect(edited.operator_id).toBe('Operator A'); expect(edited.created_at).toBe(report.created_at);
        const log = (await state.pool!.query('SELECT * FROM pallet_audit_logs WHERE id=$1', [report.audit_log_id])).rows[0];
        expect(log.operator_id).toBe('Operator A'); expect(log.description).toContain('Corrected text'); expect(log.description).not.toContain('Old text');
        expect((await state.pool!.query('SELECT count(*) FROM pallet_audit_logs')).rows[0].count).toBe(count);
        const current = (await state.pool!.query("SELECT status,block_reason FROM pallets WHERE pallet_id='PAL-01'")).rows[0];
        expect(current.status).toBe('Damaged'); expect(current.block_reason).toContain('Corrected text'); expect(current.block_reason).not.toContain('Old text');
        await expect(EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 1, description: 'Stale'})).rejects.toThrow();
    });
    it('records repeated faults separately, closes all reports on repair and rejects edits after closure', async () => {
        state.auth = operator;
        const first = await CreateOperatorReport({pallet_id: 'PAL-01', description: 'First'});
        await expect(CreateOperatorReport({pallet_id: 'PAL-01', description: 'Second'})).rejects.toThrow();
        state.auth = ur;
        await CreateOperatorReport({pallet_id: 'PAL-01', description: 'Second'});
        state.auth = ur;
        await ChangePalletStatus({pallet_id: 'PAL-01', new_status: 'Active', block_reason: 'Repaired', reset_cycles: true});
        expect((await GetOperatorReports({pallet_id: 'PAL-01'})).reports).toHaveLength(0);
        await expect(EditOperatorReport({id: first.id, pallet_id: 'PAL-01', version: 1, description: 'Late'})).rejects.toThrow();
    });
    it('records washing separately, allows description edits without changing status and closes on service', async () => {
        state.auth = operator;
        const report = await CreateOperatorReport({pallet_id: 'PAL-01', kind: 'washing', description: 'Wash before production'});
        expect(report.kind).toBe('washing');
        state.auth = ur;
        await EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 1, description: 'Corrected washing note'});
        expect((await state.pool!.query("SELECT status FROM pallets WHERE pallet_id='PAL-01'")).rows[0].status).toBe('Washing_Required');
        const history = await GetReports({mode: 'history', statuses: 'Washing_Required', acceptLanguage: 'pl'});
        expect(history.rows[0].description).toContain('wymagane mycie');
        expect(history.rows[0].description).toContain('Corrected washing note');
        expect(history.rows[0].defect).toBeNull();
        await ChangePalletStatus({pallet_id: 'PAL-01', new_status: 'Active', block_reason: 'Washed', reset_cycles: true});
        expect((await GetOperatorReports({pallet_id: 'PAL-01'})).reports).toHaveLength(0);
    });
    it('rolls back concurrent stale edits and keeps comments belonging to later events', async () => {
        state.auth = operator;
        const report = await CreateOperatorReport({pallet_id: 'PAL-01', description: 'Original'});
        state.auth = ur;
        const results = await Promise.allSettled(['Edit A', 'Edit B'].map(description => EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 1, description})));
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        state.auth = itUser;
        await BlockPallet({pallet_id: 'PAL-01', block_reason: 'Administrative reason'});
        state.auth = ur;
        await EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 2, description: 'Fixed defect'});
        expect((await state.pool!.query("SELECT status,block_reason FROM pallets WHERE pallet_id='PAL-01'")).rows[0]).toEqual({status: 'Blocked', block_reason: 'Administrative reason'});
    });
    it('enforces unblock comments and prevents reporting on blocked pallets', async () => {
        state.auth = itUser;
        await BlockPallet({pallet_id: 'PAL-01', block_reason: 'Block reason'});
        state.auth = operator;
        await expect(CreateOperatorReport({pallet_id: 'PAL-01', description: 'Blocked fault'})).rejects.toThrow();
        state.auth = itUser;
        await expect(UnblockPallet({pallet_id: 'PAL-01', comment: '  '})).rejects.toThrow();
        await UnblockPallet({pallet_id: 'PAL-01', comment: 'Checked and released'});
        expect((await state.pool!.query("SELECT block_reason FROM pallets WHERE pallet_id='PAL-01'")).rows[0].block_reason).toBeNull();
        expect((await state.pool!.query('SELECT description FROM pallet_audit_logs ORDER BY id DESC LIMIT 1')).rows[0].description).toContain('Checked and released');
    });
    it('retains the unblock comment when the cycle trigger immediately requests washing', async () => {
        state.auth = itUser;
        await BlockPallet({pallet_id: 'PAL-01', block_reason: 'Review'});
        await state.pool!.query("UPDATE pallets SET current_cycles=100 WHERE pallet_id='PAL-01'");
        await UnblockPallet({pallet_id: 'PAL-01', comment: 'Reviewed by IT'});
        const log = (await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id DESC LIMIT 1')).rows[0];
        expect(log.new_status).toBe('Washing_Required');
        expect(log.description).toContain('Reviewed by IT');
        expect(log.operator_id).toBe('IT A');
        const localized = localizeAuditLog(log, 'pl');
        expect(localized.event_kind).toBe('unblock');
        expect(localized.comment).toBe('Reviewed by IT');
        expect(localized.description).not.toMatch(/mycie|maxCycles|Reviewed by IT/);
    });
    it('does not audit automatic washing and tracks its date and service duration independently', async () => {
        state.auth = ur;
        const count = (await state.pool!.query('SELECT count(*) FROM pallet_audit_logs')).rows[0].count;
        await state.pool!.query("UPDATE pallets SET current_cycles=100 WHERE pallet_id='PAL-01'");
        expect((await state.pool!.query('SELECT count(*) FROM pallet_audit_logs')).rows[0].count).toBe(count);
        const row = (await state.pool!.query("SELECT status,status_changed_at FROM pallets WHERE pallet_id='PAL-01'")).rows[0];
        expect(row.status).toBe('Washing_Required');
        const current = await GetReports({mode: 'current', statuses: 'Washing_Required'});
        expect(current.rows[0].timestamp).toBe(row.status_changed_at.toISOString());
        await state.pool!.query("UPDATE pallets SET current_cycles=101 WHERE pallet_id='PAL-01'");
        expect((await state.pool!.query("SELECT status_changed_at FROM pallets WHERE pallet_id='PAL-01'")).rows[0].status_changed_at.toISOString()).toBe(row.status_changed_at.toISOString());
        await state.pool!.query("UPDATE pallet_service_periods SET started_at=NOW()-interval '2 hours' WHERE finished_at IS NULL");
        await ChangePalletStatus({pallet_id: 'PAL-01', new_status: 'Active', block_reason: 'Washed', reset_cycles: true});
        const dashboard = await GetPublicDashboard({station: 'ALL'});
        expect(dashboard.service.completed_30d).toBe(1);
        expect(dashboard.service.average_minutes_30d).toBe(120);
    });
    it('lets UR confirm early washing, preserves lifetime cycles and records one manual event', async () => {
        state.auth = ur;
        await state.pool!.query("UPDATE pallets SET current_cycles=40,total_cycles=400 WHERE pallet_id='PAL-01'");
        const before = (await state.pool!.query("SELECT status_changed_at FROM pallets WHERE pallet_id='PAL-01'")).rows[0];
        const result = await confirmWashing({pallet_id: 'PAL-01', expected_cycles: 40, comment: 'Washed early'});
        expect(result.reset).toBe(true);
        expect(result.pallet).toMatchObject({status: 'Active', current_cycles: 0, total_cycles: 400});
        expect((await state.pool!.query("SELECT status_changed_at FROM pallets WHERE pallet_id='PAL-01'")).rows[0].status_changed_at.toISOString()).toBe(before.status_changed_at.toISOString());
        const logs = (await state.pool!.query("SELECT * FROM pallet_audit_logs WHERE pallet_id='PAL-01' ORDER BY id")).rows;
        expect(logs).toHaveLength(2);
        expect(logs[1].operator_id).toBe('UR A');
        expect(logs[1].description).toContain('Washed early');
        expect(logs[1].description).toContain('audit_washing_confirmed');
        expect((await confirmWashing({pallet_id: 'PAL-01', expected_cycles: 0})).reset).toBe(false);
        expect((await state.pool!.query("SELECT count(*)::int AS count FROM pallet_audit_logs WHERE pallet_id='PAL-01'")).rows[0].count).toBe(2);
    });
    it('confirms queued washing and closes its operator reports atomically', async () => {
        state.auth = operator;
        await state.pool!.query("UPDATE pallets SET current_cycles=40,total_cycles=300 WHERE pallet_id='PAL-01'");
        await CreateOperatorReport({pallet_id: 'PAL-01', kind: 'washing', description: 'Wash'});
        state.auth = ur;
        const result = await confirmWashing({pallet_id: 'PAL-01', expected_cycles: 40});
        expect(result.pallet).toMatchObject({status: 'Active', current_cycles: 0, total_cycles: 300});
        expect((await GetOperatorReports({pallet_id: 'PAL-01'})).reports).toHaveLength(0);
        expect((await state.pool!.query('SELECT count(*)::int AS count FROM pallet_service_periods WHERE completed')).rows[0].count).toBe(1);
    });
    it('rejects operators, damaged/blocked pallets and stale counts without resetting them', async () => {
        await state.pool!.query("UPDATE pallets SET current_cycles=40 WHERE pallet_id='PAL-01'");
        state.auth = operator;
        await expect(confirmWashing({pallet_id: 'PAL-01', expected_cycles: 40})).rejects.toThrow();
        state.auth = ur;
        await expect(confirmWashing({pallet_id: 'PAL-01', expected_cycles: 39})).rejects.toThrow(/changed|zmienił/);
        for (const status of ['Damaged', 'Blocked']) {
            await state.pool!.query("UPDATE pallets SET status=$1 WHERE pallet_id='PAL-01'", [status]);
            await expect(confirmWashing({pallet_id: 'PAL-01', expected_cycles: 40})).rejects.toThrow(/Washing|Mycie/);
            expect((await state.pool!.query("SELECT current_cycles FROM pallets WHERE pallet_id='PAL-01'")).rows[0].current_cycles).toBe(40);
        }
    });
    it('serializes simultaneous confirmations and rolls back a reset when audit insertion fails', async () => {
        state.auth = ur;
        await state.pool!.query("UPDATE pallets SET current_cycles=40 WHERE pallet_id='PAL-01'");
        const results = await Promise.allSettled([confirmWashing({pallet_id: 'PAL-01', expected_cycles: 40}), confirmWashing({pallet_id: 'PAL-01', expected_cycles: 40})]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect((await state.pool!.query('SELECT count(*)::int AS count FROM pallet_audit_logs')).rows[0].count).toBe(2);
        await state.pool!.query("UPDATE pallets SET current_cycles=20 WHERE pallet_id='PAL-01'; CREATE FUNCTION reject_wash_audit() RETURNS trigger AS $$ BEGIN IF NEW.description LIKE '%audit_washing_confirmed%' THEN RAISE EXCEPTION 'Test rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_wash_audit BEFORE INSERT ON pallet_audit_logs FOR EACH ROW EXECUTE FUNCTION reject_wash_audit()");
        try {
            await expect(confirmWashing({pallet_id: 'PAL-01', expected_cycles: 20})).rejects.toThrow();
            expect((await state.pool!.query("SELECT current_cycles FROM pallets WHERE pallet_id='PAL-01'")).rows[0].current_cycles).toBe(20);
        } finally {await state.pool!.query('DROP TRIGGER reject_wash_audit ON pallet_audit_logs; DROP FUNCTION reject_wash_audit()');}
    });
    it('rejects an old scan even if later production returns the counter to the same number', async () => {
        state.auth = ur;
        await state.pool!.query("UPDATE pallets SET current_cycles=20 WHERE pallet_id='PAL-01'");
        const scan = (await state.pool!.query("SELECT updated_at FROM pallets WHERE pallet_id='PAL-01'")).rows[0].updated_at.toISOString();
        await state.pool!.query("UPDATE pallets SET current_cycles=0,updated_at=updated_at+interval '1 second' WHERE pallet_id='PAL-01'; UPDATE pallets SET current_cycles=20,updated_at=updated_at+interval '1 second' WHERE pallet_id='PAL-01'");
        await expect(confirmWashing({pallet_id: 'PAL-01', expected_cycles: 20, expected_updated_at: scan})).rejects.toThrow(/changed|zmieniły/);
        expect((await state.pool!.query("SELECT current_cycles FROM pallets WHERE pallet_id='PAL-01'")).rows[0].current_cycles).toBe(20);
    });
    it('filters complete Warsaw days across DST, paginates history and uses status entry date', async () => {
        state.auth = ur;
        await state.pool!.query("UPDATE pallets SET status='Damaged'; UPDATE pallet_audit_logs SET timestamp='2026-03-28T23:00:00Z' WHERE new_status='Damaged'; UPDATE pallets SET status_changed_at='2026-03-28T23:00:00Z' WHERE pallet_id='PAL-01'; UPDATE pallets SET current_cycles=1, updated_at=NOW(); INSERT INTO pallet_audit_logs(pallet_id,operator_id,previous_status,new_status,description,timestamp) VALUES('PAL-01','System','Damaged','Damaged','Later metadata','2026-03-29T22:00:00Z')");
        const current = await GetReports({mode: 'current', from: '2026-03-29', to: '2026-03-29', statuses: 'Damaged'});
        expect(current.rows).toHaveLength(1); expect(current.rows[0].timestamp).toBe('2026-03-28T23:00:00.000Z');
        const history = await GetReports({mode: 'history', from: '2026-03-29', to: '2026-03-29', statuses: 'Damaged'});
        expect(history.rows).toHaveLength(1);
        await expect(GetReports({mode: 'history', from: '2026-02-30'})).rejects.toThrow();
        await expect(GetReports({mode: 'current', from: '2026-10-12', to: '2026-10-11'})).rejects.toThrow();
        const page = await GetReports({mode: 'history', limit: 1});
        expect(page.rows).toHaveLength(1); expect(page.next_offset).toBe(1);
        expect((await GetReports({mode: 'history', limit: 1, offset: page.next_offset})).rows[0].id).not.toBe(page.rows[0].id);
        state.auth = operator;
        await expect(GetReports({mode: 'current'})).rejects.toThrow();
    });
    it('defaults machines to WSM and audits machine edits', async () => {
        expect((await state.pool!.query("SELECT machine FROM pallets WHERE pallet_id='PAL-01'")).rows[0].machine).toBe('WSM');
        await state.pool!.query("UPDATE pallets SET machine='COAT',last_operation_description='Machine changed' WHERE pallet_id='PAL-01'");
        expect((await state.pool!.query('SELECT description FROM pallet_audit_logs ORDER BY id DESC LIMIT 1')).rows[0].description).toBe('Machine changed');
        await expect(state.pool!.query("UPDATE pallets SET machine='INVALID'")).rejects.toThrow();
    });
    it('registers machines on individual/range pallets and preserves the FIS outbox contract', async () => {
        state.auth = itUser;
        await AddPallet({pallet_id: 'PAL-02', project: 'Project', model: 'Model', machine: 'SSM', fis: 1, nests: 1, max_cycles: 100, status: 'Active'});
        await AddPalletRange({first_pallet_id: 'COAT-01', last_pallet_id: 'COAT-03', project: 'Project', model: 'Model', machine: 'COAT', fis: 2, nests: 1, max_cycles: 100, status: 'Active'});
        expect((await state.pool!.query("SELECT machine FROM pallets WHERE pallet_id LIKE 'COAT-%'")).rows.map(row => row.machine)).toEqual(['COAT', 'COAT', 'COAT']);
        await UpdatePallet({pallet_id: 'PAL-02', machine: 'WSM'});
        expect((await state.pool!.query("SELECT machine FROM pallets WHERE pallet_id='PAL-02'")).rows[0].machine).toBe('WSM');
        const jobs = (await state.pool!.query('SELECT payload FROM fis_outbox')).rows;
        expect(jobs).toHaveLength(4);
        expect(jobs.every(job => !('machine' in job.payload.details))).toBe(true);
        await expect(AddPallet({pallet_id: 'BAD', project: 'Project', model: 'Model', machine: 'BAD' as 'WSM', fis: 1, nests: 1, max_cycles: 100, status: 'Active'})).rejects.toThrow();
    });
    it('rolls back every edited field if rewriting the linked history entry fails', async () => {
        state.auth = operator;
        const report = await CreateOperatorReport({pallet_id: 'PAL-01', description: 'Keep this'});
        state.auth = ur;
        await state.pool!.query("CREATE FUNCTION reject_test_edit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Test rollback'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_test_edit BEFORE UPDATE ON pallet_audit_logs FOR EACH ROW EXECUTE FUNCTION reject_test_edit()");
        try {
            await expect(EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 1, description: 'Must rollback'})).rejects.toThrow();
            expect((await state.pool!.query('SELECT description,version FROM operator_reports WHERE id=$1', [report.id])).rows[0]).toEqual({description: 'Keep this', version: 1});
        } finally {
            await state.pool!.query('DROP TRIGGER reject_test_edit ON pallet_audit_logs; DROP FUNCTION reject_test_edit()');
        }
    });
    it('serializes service completion with an edit and leaves the report closed', async () => {
        state.auth = operator;
        const report = await CreateOperatorReport({pallet_id: 'PAL-01', description: 'Initial'});
        state.auth = ur;
        const results = await Promise.allSettled([
            ChangePalletStatus({pallet_id: 'PAL-01', new_status: 'Active', block_reason: 'Repaired', reset_cycles: true}),
            EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 1, description: 'Edited concurrently'}),
        ]);
        expect(results[0].status).toBe('fulfilled');
        expect((await GetOperatorReports({pallet_id: 'PAL-01'})).reports).toHaveLength(0);
        expect((await state.pool!.query("SELECT status,block_reason FROM pallets WHERE pallet_id='PAL-01'")).rows[0]).toEqual({status: 'Active', block_reason: null});
    });
});
