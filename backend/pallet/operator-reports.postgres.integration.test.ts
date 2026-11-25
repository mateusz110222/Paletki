import {beforeAll, beforeEach, afterAll, describe, expect, it, vi} from 'vitest';
import {Pool, type PoolClient} from 'pg';
import {readFileSync, readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {AuthData} from '../shared/auth-data';

const state = vi.hoisted(() => ({
    pool: null as Pool | null, auth: null as AuthData | null, cardName: 'Anna Nowak',
    afterRead: null as ((sql: string) => Promise<void>) | null,
    sync: vi.fn(), ensure: vi.fn(), delete: vi.fn(),
    fis: {strainBlocking: false, requestTimeoutMs: 1000, outboxCompletedRetentionDays: 30, outboxWorkerToken: 'fixture-worker-token',
        router1Url: 'http://fis-1.test', router2Url: 'http://fis-2.test'},
}));
vi.mock('./fis-client', () => ({FisClient: class {
    synchronizeUnit = state.sync;
    ensureUnitPresent = state.ensure;
    deleteUnitIfPresent = state.delete;
}}));
vi.mock('~encore/auth', () => ({getAuthData: () => state.auth}));
vi.mock('encore.dev/auth', () => ({authHandler: (handler: unknown) => handler}));
vi.mock('../shared/persistence', async () => ({palletsDatabase: (await import('./db')).db}));
vi.mock('../auth/apacs', () => ({findActiveCardOperator: async () => ({externalId: '17', fullName: state.cardName})}));
vi.mock('../auth/secrets', () => ({apacsDbPassword: () => 'test'}));
vi.mock('../config', () => ({config: {
    fis: state.fis,
    auth: {sessionTtlMinutes: 720}, apacs: {server: 'test', user: 'test'},
    fisGroups: {itGroups: [], urGroup: 'UR', meGroup: 'ME'},
}}));
vi.mock('encore.dev/api', () => {
    class TestAPIError extends Error {
        withDetails(details: unknown) {return Object.assign(this, {details});}
        static invalidArgument(message: string) {return new TestAPIError(message);}
        static permissionDenied(message: string) {return new TestAPIError(message);}
        static notFound(message: string) {return new TestAPIError(message);}
        static alreadyExists(message: string) {return new TestAPIError(message);}
        static unauthenticated(message: string) {return new TestAPIError(message);}
        static failedPrecondition(message: string) {return new TestAPIError(message);}
        static aborted(message: string) {return new TestAPIError(message);}
        static internal(message: string) {return new TestAPIError(message);}
    }
    return {api: (_options: unknown, handler: unknown) => handler, APIError: TestAPIError, Gateway: class {}};
});
vi.mock('./db', () => {
    function adapter(client: Pool | PoolClient) {
        const run = (parts: TemplateStringsArray, values: unknown[]) => client.query(parts.map((part, index) => part + (index < values.length ? `$${index + 1}` : '')).join(''), values);
        return {
            queryAll: async (parts: TemplateStringsArray, ...values: unknown[]) => {
                const result = await run(parts, values);
                await state.afterRead?.(parts.join(''));
                return result.rows;
            },
            queryRow: async (parts: TemplateStringsArray, ...values: unknown[]) => {
                const result = await run(parts, values);
                await state.afterRead?.(parts.join(''));
                return result.rows[0] ?? null;
            },
            exec: async (parts: TemplateStringsArray, ...values: unknown[]) => {await run(parts, values);},
        };
    }
    return {db: {
        exec: async (parts: TemplateStringsArray, ...values: unknown[]) => adapter(state.pool!).exec(parts, ...values),
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
import {ChangePalletStatus, BlockPallet, ResetPalletCycles, UnblockPallet} from './status';
import {AddPallet, AddPalletRange, UpdatePallet, DeletePallet, GetPallet, GetAllPallets, GetPalletHistory, GetAllPalletHistory} from './pallet';
import {ConfirmPalletWashing} from './washing';
import {GetPublicDashboard} from './dashboard';
import {UpdateModel} from './model-catalog';
import {UpdateProject} from './projects';
import {authentication, CardLogin} from '../auth/auth';
import {ProcessFisOutbox, ReconcileFisOutbox, enqueueFisSync} from './fis-outbox';
import {db} from './db';
import {localizeAuditLog} from './audit-description';
import {GetStrainHistory, GetStrainPallets, RecordStrainMeasurement, RecordStrainMeasurements} from './strain';
import {GetSolderingPallet, RegisterSolderingCycle, SetSolderingStationPallet} from '../fis/soldering';

const operator: AuthData = {fullName: 'Operator A', hasITDepartmentAccess: false, hasURDepartmentAccess: false, hasMEDepartmentAccess: false} as AuthData;
const ur: AuthData = {...operator, fullName: 'UR A', hasURDepartmentAccess: true};
const itUser: AuthData = {...operator, fullName: 'IT A', hasITDepartmentAccess: true};
const workerCredentials = {workerToken: state.fis.outboxWorkerToken};
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
        state.fis.strainBlocking = false;
        state.afterRead = null;
        state.sync.mockReset().mockResolvedValue(undefined);
        state.ensure.mockReset().mockResolvedValue(undefined);
        state.delete.mockReset().mockResolvedValue(true);
        await state.pool!.query('TRUNCATE auth_sessions, fis_outbox, operator_reports, defects, pallet_audit_logs, pallets, pallet_models, projects CASCADE');
        await state.pool!.query('UPDATE fis_reconciliation_state SET last_pallet_id=0');
        await state.pool!.query("INSERT INTO projects(id,name) VALUES(1,'Project'); INSERT INTO pallet_models(id,project_id,name) VALUES(1,1,'Model'); INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by) VALUES('PAL-01',1,1,100,1,'IT A')");
    });
    afterAll(async () => {await state.pool?.end();});
    it('requires LAB membership, audits measurements and checks FIS eligibility on the Warsaw calendar', async () => {
        const pallet = {pallet_id: 'PAL-01'};
        const station = {...pallet, station: 'SOLDER-01'};
        state.auth = ur;
        await expect(GetStrainPallets({})).rejects.toThrow(/cpe/);
        await expect(GetStrainHistory(pallet)).rejects.toThrow(/cpe/);
        await expect(RecordStrainMeasurement({...pallet, measured_on: '2025-01-01'})).rejects.toThrow(/cpe/);
        await expect(GetSolderingPallet(pallet)).resolves.toMatchObject({...pallet, strain_status: 'missing'});

        state.auth = {...operator, userID: 'lab-user', hasLabAccess: true};
        state.fis.strainBlocking = true;
        await expect(GetSolderingPallet(pallet)).rejects.toMatchObject({details: {reason: 'STRAIN_MISSING'}});
        await expect(SetSolderingStationPallet(station)).rejects.toMatchObject({details: {reason: 'STRAIN_MISSING'}});
        await expect(RegisterSolderingCycle(station)).rejects.toMatchObject({details: {reason: 'STRAIN_MISSING'}});
        const {today, pallets} = await GetStrainPallets({});
        expect(pallets).toMatchObject([{strain_status: 'missing'}]);
        const daysAgo = (days: number) => new Date(Date.parse(today) - days * 86_400_000).toISOString().slice(0, 10);
        await expect(RecordStrainMeasurement({...pallet, measured_on: daysAgo(-1), acceptLanguage: 'en'})).rejects.toThrow(/future/);
        await expect(RecordStrainMeasurement({...pallet, measured_on: '2025-02-29', acceptLanguage: 'en'})).rejects.toThrow(/valid/);
        await RecordStrainMeasurement({...pallet, measured_on: daysAgo(366)});
        state.fis.strainBlocking = false;
        await expect(GetSolderingPallet(pallet)).resolves.toMatchObject({...pallet, strain_status: 'expired'});
        state.fis.strainBlocking = true;
        await expect(GetSolderingPallet(pallet)).rejects.toMatchObject({details: {reason: 'STRAIN_EXPIRED'}});
        await expect(RegisterSolderingCycle(station)).rejects.toMatchObject({details: {reason: 'STRAIN_EXPIRED'}});
        await RecordStrainMeasurement({...pallet, measured_on: daysAgo(365)});
        expect((await GetStrainPallets({})).pallets).toMatchObject([{strain_status: 'due_soon', due_on: today}]);
        await expect(GetSolderingPallet(pallet)).resolves.toMatchObject(pallet);
        await expect(SetSolderingStationPallet(station)).resolves.toMatchObject(station);
        await RecordStrainMeasurement({...pallet, measured_on: today});
        await RecordStrainMeasurement({...pallet, measured_on: today});
        expect((await GetStrainPallets({})).pallets).toMatchObject([{strain_status: 'current', measured_on: today}]);
        const {measurements} = await GetStrainHistory(pallet);
        expect(measurements.map(({measured_on, recorded_by}) => [measured_on, recorded_by]))
            .toEqual([today, daysAgo(365), daysAgo(366)].map(date => [date, 'lab-user']));
        await state.pool!.query("UPDATE pallets SET created_at = created_at + interval '1 second' WHERE pallet_id = 'PAL-01'");
        await expect(GetSolderingPallet(pallet)).rejects.toMatchObject({details: {reason: 'STRAIN_MISSING'}});
    });
    it('records a LAB selection atomically and accepts retries', async () => {
        const params = {pallet_ids: ['PAL-01', 'PAL-02'], measured_on: '2025-01-01'};
        await expect(RecordStrainMeasurements(params)).rejects.toThrow(/cpe/);
        state.auth = {...operator, userID: 'lab-user', hasLabAccess: true};
        await expect(RecordStrainMeasurements(params)).rejects.toThrow();
        expect((await GetStrainHistory({pallet_id: 'PAL-01'})).measurements).toHaveLength(0);
        await state.pool!.query("INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by) VALUES('PAL-02',1,1,100,1,'IT A')");
        await RecordStrainMeasurements(params);
        await RecordStrainMeasurements(params);
        for (const pallet_id of params.pallet_ids) {
            expect((await GetStrainHistory({pallet_id})).measurements).toMatchObject([
                {measured_on: params.measured_on, recorded_by: 'lab-user'},
            ]);
        }
    });
    it.each(['history', 'current'] as const)('keeps sub-millisecond rows across %s report pages', async mode => {
        await state.pool!.query("INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by) VALUES('PAL-02',1,1,100,1,'IT A')");
        await state.pool!.query(`UPDATE pallets SET status_changed_at = '2025-02-01T12:00:00.123900Z'::timestamptz
                - CASE WHEN pallet_id = 'PAL-02' THEN interval '100 microseconds' ELSE interval '0' END;
            UPDATE pallet_audit_logs a SET timestamp = p.status_changed_at FROM pallets p WHERE p.pallet_id = a.pallet_id`);
        const first = await GetReports({mode, limit: 1});
        const next = await GetReports({mode, limit: 1, before_timestamp: first.next_before_timestamp, before_id: first.next_before_id});
        expect(first.rows[0].pallet_id).toBe('PAL-01');
        expect(next.rows.map(row => row.pallet_id)).toEqual(['PAL-02']);
    });
    it('allows cycles on different pallets sharing a project and model to run in parallel', async () => {
        await state.pool!.query("INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by) VALUES('PAL-02',1,1,100,1,'IT A')");
        let signalRead!: () => void, releaseRead!: () => void;
        const locked = new Promise<void>(resolve => {signalRead = resolve;});
        const release = new Promise<void>(resolve => {releaseRead = resolve;});
        state.afterRead = async sql => {
            if (sql.includes('SELECT a.id, a.status, a.current_cycles')) {
                state.afterRead = null;
                signalRead();
                await release;
            }
        };
        const first = RegisterSolderingCycle({pallet_id: 'PAL-01', station: 'SOLDER-01'});
        await locked;
        const second = RegisterSolderingCycle({pallet_id: 'PAL-02', station: 'SOLDER-02'});
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const deadline = new Promise(resolve => {timer = setTimeout(() => resolve('blocked by another pallet'), 1000);});
            expect(await Promise.race([second, deadline])).toMatchObject({status: true, current_cycles: 1});
        } finally {
            clearTimeout(timer);
            releaseRead();
            await Promise.all([first, second]);
        }
    });
    it('serializes reconciliation snapshots with deletion so DELETE remains the last queued job', async () => {
        state.auth = itUser;
        let signalRead!: () => void, releaseRead!: () => void;
        const read = new Promise<void>(resolve => {signalRead = resolve;});
        const release = new Promise<void>(resolve => {releaseRead = resolve;});
        state.afterRead = async sql => {
            if (sql.includes('WITH batch AS MATERIALIZED')) {signalRead(); await release;}
        };
        const reconciliation = ReconcileFisOutbox(workerCredentials);
        await read;
        const deletion = DeletePallet({pallet_id: 'PAL-01'});
        try {
            expect(await Promise.race([deletion.then(() => 'deleted'), new Promise(resolve => setTimeout(() => resolve('locked'), 100))])).toBe('locked');
        } finally {
            state.afterRead = null;
            releaseRead();
            await Promise.all([reconciliation, deletion]);
        }
        expect((await state.pool!.query('SELECT operation FROM fis_outbox ORDER BY id')).rows).toEqual([{operation: 'SYNC'}, {operation: 'DELETE'}]);
        await ProcessFisOutbox({...workerCredentials, limit: 2});
        expect(state.ensure).toHaveBeenCalledOnce();
        expect(state.delete).toHaveBeenCalledOnce();
        expect((await state.pool!.query("SELECT deleted_at IS NOT NULL AS deleted FROM pallets WHERE pallet_id='PAL-01'")).rows[0].deleted).toBe(true);
    });
    it('reserves each FIS job just before execution, preserving order for the same pallet', async () => {
        await using tx = await db.begin();
        for (let i = 0; i < 2; i++) await enqueueFisSync(tx, 1, {pallet_id: 'PAL-01', project: 'Project', model: 'Model'}, 'IT');
        await tx.commit();
        let started!: () => void, finish!: () => void;
        const ready = new Promise<void>(resolve => {started = resolve;});
        const release = new Promise<void>(resolve => {finish = resolve;});
        state.sync.mockImplementationOnce(async () => {started(); await release;});
        const processing = ProcessFisOutbox({...workerCredentials, limit: 2});
        await ready;
        try {
            const rows = (await state.pool!.query('SELECT status,lease_token FROM fis_outbox ORDER BY id')).rows;
            expect(rows[0]).toMatchObject({status: 'processing', lease_token: expect.any(String)});
            expect(rows[1]).toEqual({status: 'pending', lease_token: null});
        } finally {finish();}
        expect(await processing).toMatchObject({claimed: 2, completed: 2, retried: 0, dead: 0});
    });
    for (const fails of [false, true]) {
        it(`does not overwrite a newer lease after a stale worker ${fails ? 'fails' : 'succeeds'}`, async () => {
            await using tx = await db.begin();
            await enqueueFisSync(tx, 1, {pallet_id: 'PAL-01', project: 'Project', model: 'Model'}, 'IT');
            await tx.commit();
            let started!: () => void, finish!: () => void;
            const ready = new Promise<void>(resolve => {started = resolve;});
            const release = new Promise<void>(resolve => {finish = resolve;});
            state.sync.mockImplementationOnce(async () => {started(); await release; if (fails) throw new Error('FIS failure');});
            const processing = ProcessFisOutbox({...workerCredentials, limit: 1});
            await ready;
            const lease = randomUUID();
            await state.pool!.query("UPDATE fis_outbox SET lease_token=$1,attempts=attempts+1,locked_at=NOW() WHERE status='processing'", [lease]);
            finish();
            expect(await processing).toMatchObject({claimed: 1, completed: 0, retried: 0, dead: 0});
            expect((await state.pool!.query('SELECT status,lease_token FROM fis_outbox')).rows).toEqual([{status: 'processing', lease_token: lease}]);
        });
    }
    it('recovers an expired FIS lease and keeps failure retry limits', async () => {
        await using tx = await db.begin();
        await enqueueFisSync(tx, 1, {pallet_id: 'PAL-01', project: 'Project', model: 'Model'}, 'IT');
        await tx.commit();
        await state.pool!.query("UPDATE fis_outbox SET status='processing',locked_at=NOW()-interval '16 minutes',lease_token=$1,attempts=8", [randomUUID()]);
        state.sync.mockRejectedValue(new Error('FIS failure'));
        expect(await ProcessFisOutbox({...workerCredentials, limit: 1})).toMatchObject({claimed: 1, retried: 1, dead: 0});
        expect((await state.pool!.query('SELECT status,lease_token,attempts FROM fis_outbox')).rows).toEqual([{status: 'pending', lease_token: null, attempts: 9}]);
        await state.pool!.query("UPDATE fis_outbox SET available_at=NOW()");
        expect(await ProcessFisOutbox({...workerCredentials, limit: 1})).toMatchObject({claimed: 1, retried: 0, dead: 1});
        expect((await state.pool!.query('SELECT status,lease_token,attempts FROM fis_outbox')).rows).toEqual([{status: 'dead', lease_token: null, attempts: 10}]);
    });
    it('rejects unauthenticated workers and releases the queue after the last lease expires', async () => {
        await expect(ProcessFisOutbox({limit: 1})).rejects.toThrow(/worker credentials/);
        await expect(ReconcileFisOutbox({workerToken: 'incorrect-token'})).rejects.toThrow(/worker credentials/);
        expect((await state.pool!.query('SELECT * FROM fis_outbox')).rows).toEqual([]);
        await ReconcileFisOutbox(workerCredentials);
        await state.pool!.query("UPDATE fis_outbox SET status='processing', locked_at=NOW()-interval '16 minutes', lease_token=$1, attempts=10", [randomUUID()]);
        await using tx = await db.begin();
        await enqueueFisSync(tx, 1, {pallet_id: 'PAL-01', project: 'Project', model: 'Model'}, 'IT');
        await tx.commit();
        expect(await ProcessFisOutbox({...workerCredentials, limit: 1})).toMatchObject({claimed: 1, completed: 1});
        expect((await state.pool!.query('SELECT status, attempts FROM fis_outbox ORDER BY id')).rows).toEqual([
            {status: 'dead', attempts: 10}, {status: 'completed', attempts: 1},
        ]);
    });
    it('keeps a damaged pallet and its defect open until the repair is completed', async () => {
        const pallet_id = 'PAL-01';
        await CreateOperatorReport({pallet_id, description: 'Broken latch'});
        state.auth = itUser;
        await expect(CreateOperatorReport({pallet_id, kind: 'washing', acceptLanguage: 'en'})).rejects.toThrow(/complete the repair/i);
        await expect(ChangePalletStatus({pallet_id, new_status: 'Washing_Required', block_reason: 'Wash', acceptLanguage: 'en'})).rejects.toThrow(/complete the repair/i);
        await expect(UpdatePallet({pallet_id, status: 'Washing_Required', acceptLanguage: 'en'})).rejects.toThrow(/complete the repair/i);
        expect((await GetPallet({pallet_id})).pallet.status).toBe('Damaged');
        expect((await state.pool!.query("SELECT kind, closed_at FROM operator_reports")).rows).toEqual([{kind: 'defect', closed_at: null}]);
    });
    it('requires a release comment when resetting a blocked pallet and records that comment', async () => {
        const pallet_id = 'PAL-01';
        state.auth = itUser;
        await BlockPallet({pallet_id, block_reason: 'Inspection'});
        await expect(ResetPalletCycles({pallet_id})).rejects.toThrow();
        await expect(ResetPalletCycles({pallet_id, block_reason: 'Inspection complete'})).resolves.toMatchObject({new_status: 'Active'});
        expect((await GetPalletHistory({pallet_id})).history[0].description).toContain('Inspection complete');
    });
    it('matches literal underscores and percent signs in searches', async () => {
        await state.pool!.query(`INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by)
            VALUES ('PAL-A_B',1,1,100,1,'QA%'), ('PAL-AXB',1,1,100,1,'QA')`);
        expect((await GetAllPallets({query: 'A_B'})).pallets.map(pallet => pallet.pallet_id)).toEqual(['PAL-A_B']);
        expect((await GetAllPallets({query: '%'})).pallets.map(pallet => pallet.pallet_id)).toEqual(['PAL-A_B']);
    });
    it('attributes automatic washing to System rather than a previous washing report author', async () => {
        await state.pool!.query("UPDATE pallets SET status='Washing_Required',updated_by='Old operator' WHERE pallet_id='PAL-01'; UPDATE pallet_audit_logs SET timestamp=NOW()-interval '1 day' WHERE new_status='Washing_Required'");
        await ChangePalletStatus({pallet_id: 'PAL-01', new_status: 'Active', reset_cycles: true, block_reason: 'Washed'});
        await state.pool!.query("UPDATE pallets SET current_cycles=max_cycles WHERE pallet_id='PAL-01'");
        const report = await GetReports({mode: 'current', statuses: 'Washing_Required'});
        expect(report.rows).toHaveLength(1);
        expect(report.rows[0].operator).toBe('System');
    });
    it('groups dashboard services by Warsaw days even when the database uses UTC', async () => {
        await state.pool!.query(`INSERT INTO pallet_service_periods(pallet_id,service_status,started_at,finished_at,completed)
            SELECT 'PAL-01','Washing_Required',finished-interval '10 minutes',finished,true
            FROM (SELECT ((NOW() AT TIME ZONE 'Europe/Warsaw')::date + interval '30 minutes') AT TIME ZONE 'Europe/Warsaw' AS finished) times`);
        const today = (await state.pool!.query("SELECT TO_CHAR(NOW() AT TIME ZONE 'Europe/Warsaw','YYYY-MM-DD') AS day")).rows[0].day;
        const dashboard = await GetPublicDashboard({station: 'ALL'});
        expect(dashboard.service.daily.find(day => day.day === today)).toMatchObject({completed: 1, average_minutes: 10});
        expect(dashboard.service.daily.reduce((sum, day) => sum + day.completed, 0)).toBe(1);
    });
    it('keeps three-project monitor data while calculating station service statistics for the current project', async () => {
        await state.pool!.query(`UPDATE pallets SET machine='COAT';
            INSERT INTO projects(id,name) VALUES(2,'Previous project');
            INSERT INTO pallet_models(id,project_id,name) VALUES(2,2,'Previous model');
            INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by,machine) VALUES('PREVIOUS',2,2,100,1,'IT','COAT');
            INSERT INTO production_stations(station,pallet_id,updated_at) VALUES('LUD047','PREVIOUS',NOW()-interval '1 minute'),('LUD047','PAL-01',NOW());
            INSERT INTO pallet_service_periods(pallet_id,service_status,started_at,finished_at,completed) VALUES
                ('PAL-01','Washing_Required',NOW()-interval '10 minutes',NOW(),true),
                ('PREVIOUS','Washing_Required',NOW()-interval '90 minutes',NOW(),true)`);
        const dashboard = await GetPublicDashboard({station: 'LUD047'});
        expect(dashboard.station_history).toHaveLength(2);
        expect(dashboard.pallets).toHaveLength(2);
        expect(dashboard.service).toMatchObject({completed_30d: 1, average_minutes_30d: 10});
        expect(dashboard.service.daily.reduce((sum, day) => sum + day.completed, 0)).toBe(1);
        expect((await GetPublicDashboard({station: 'ALL'})).service).toMatchObject({completed_30d: 2, average_minutes_30d: 50});
    });
    it('allows clearing washing comments during editing but still requires descriptions for Other defects', async () => {
        const washing = await CreateOperatorReport({pallet_id: 'PAL-01', kind: 'washing', description: 'Old comment'});
        const cleared = await EditOperatorReport({id: washing.id, pallet_id: 'PAL-01', version: 1, description: ''});
        expect(cleared.description).toBe('');
        expect((await EditOperatorReport({id: washing.id, pallet_id: 'PAL-01', version: 2})).description).toBe('');
        const other = await CreateOperatorReport({pallet_id: 'PAL-01', description: 'Other defect'});
        await expect(EditOperatorReport({id: other.id, pallet_id: 'PAL-01', version: 1, description: ''})).rejects.toThrow();
    });
    it('preserves 256-character card identities through login, reporting, editing, service and pallet writes', async () => {
        state.cardName = 'A'.repeat(128) + ' ' + 'B'.repeat(127);
        const login = await CardLogin({identifier: '123'});
        expect(login.data.FullName).toBe(state.cardName);
        state.auth = await authentication({authorization: `Bearer ${login.token}`});
        const report = await CreateOperatorReport({pallet_id: 'PAL-01', kind: 'washing'});
        expect(report.operator_id).toBe(state.cardName);
        state.auth = {...state.auth!, hasURDepartmentAccess: true};
        expect((await EditOperatorReport({id: report.id, pallet_id: 'PAL-01', version: 1, description: 'Checked'})).edited_by).toBe(state.cardName);
        await confirmWashing({pallet_id: 'PAL-01', expected_cycles: 0});
        state.auth = {...state.auth!, hasITDepartmentAccess: true};
        await AddPallet({pallet_id: 'LONGNAME-01', project: 'Project', model: 'Model', machine: 'WSM', fis: 1, nests: 1, max_cycles: 100, status: 'Active'});
        await DeletePallet({pallet_id: 'LONGNAME-01'});
        const saved = (await state.pool!.query("SELECT created_by,updated_by,deleted_by FROM pallets WHERE pallet_id='LONGNAME-01'")).rows[0];
        expect(saved).toEqual({created_by: state.cardName, updated_by: state.cardName, deleted_by: state.cardName});
        expect((await state.pool!.query("SELECT operator_id FROM pallet_audit_logs WHERE pallet_id='LONGNAME-01'")).rows.every(row => row.operator_id === state.cardName)).toBe(true);
    });
    it('rejects stale model moves and preserves a concurrent move during a rename-only save', async () => {
        state.auth = itUser;
        await state.pool!.query("INSERT INTO projects(id,name) VALUES(2,'Destination'),(3,'Other')");
        await UpdateModel({id: 1, name: 'Model', project_id: 2, expected_project_id: 1});
        const before = (await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id')).rows;
        for (const project_id of [1, 2, 3]) {
            await expect(UpdateModel({id: 1, name: 'Stale name', project_id, expected_project_id: 1})).rejects.toThrow(/nieaktualny|outdated/);
        }
        await expect(UpdateModel({id: 1, name: 'Missing guard', project_id: 3})).rejects.toThrow();
        expect((await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id')).rows).toEqual(before);
        expect((await state.pool!.query('SELECT COUNT(*)::int AS count FROM fis_outbox')).rows[0].count).toBe(1);
        await UpdateModel({id: 1, name: 'Renamed only'});
        expect((await state.pool!.query('SELECT project,model FROM pallet_details')).rows).toEqual([{project: 'Destination', model: 'Renamed only'}]);
        expect((await state.pool!.query('SELECT project_id FROM pallet_models WHERE id=1')).rows[0].project_id).toBe(2);
    });
    it('moves a model and all linked pallets atomically, preserving history and synchronizing active pallets', async () => {
        state.auth = itUser;
        await state.pool!.query(`INSERT INTO projects(id,name) VALUES(2,'Destination');
            UPDATE pallets SET current_cycles=12,total_cycles=112 WHERE pallet_id='PAL-01';
            INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by,deleted_at)
                VALUES('ARCHIVED',1,1,100,1,'IT',NOW())`);
        const before = (await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id')).rows;
        await UpdateModel({id: 1, name: 'Renamed model', project_id: 2, expected_project_id: 1});
        expect((await state.pool!.query('SELECT id,project_id,name FROM pallet_models')).rows)
            .toEqual([{id: 1, project_id: 2, name: 'Renamed model'}]);
        expect((await state.pool!.query('SELECT pallet_id,project_id,model_id FROM pallet_details ORDER BY id')).rows)
            .toEqual([{pallet_id: 'PAL-01', project_id: 2, model_id: 1}, {pallet_id: 'ARCHIVED', project_id: 2, model_id: 1}]);
        expect((await state.pool!.query("SELECT current_cycles,total_cycles,status FROM pallets WHERE pallet_id='PAL-01'")).rows[0])
            .toEqual({current_cycles: 12, total_cycles: 112, status: 'Active'});
        expect((await state.pool!.query("SELECT deleted_at IS NOT NULL AS archived FROM pallets WHERE pallet_id='ARCHIVED'")).rows[0].archived).toBe(true);
        const after = (await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id')).rows;
        expect(after.slice(0, before.length)).toEqual(before);
        expect(after).toHaveLength(before.length + 2);
        expect(after.slice(before.length).every(row => row.description.includes('audit_model_moved') && row.description.includes('audit_catalog_renamed'))).toBe(true);
        const jobs = (await state.pool!.query('SELECT pallet_id,payload FROM fis_outbox')).rows;
        expect(jobs).toHaveLength(1);
        expect(jobs[0]).toMatchObject({pallet_id: 'PAL-01', payload: {details: {project: 'Destination', model: 'Renamed model'}}});
        await UpdateModel({id: 1, name: 'Renamed model', project_id: 2, expected_project_id: 2});
        expect((await state.pool!.query('SELECT COUNT(*)::int AS count FROM fis_outbox')).rows[0].count).toBe(1);
    });
    it('rejects conflicting, invalid and unauthorized model moves without changing linked pallets', async () => {
        await expect(UpdateModel({id: 1, name: 'Model', project_id: 2, expected_project_id: 1})).rejects.toThrow();
        state.auth = itUser;
        await state.pool!.query("INSERT INTO projects(id,name) VALUES(2,'Destination'); INSERT INTO pallet_models(id,project_id,name) VALUES(2,2,'Model')");
        const before = (await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id')).rows;
        await expect(UpdateModel({id: 1, name: 'Model', project_id: 2, expected_project_id: 1})).rejects.toThrow(/already exists|już istnieje/);
        for (const project_id of [0, -1, 1.5, 999]) {
            await expect(UpdateModel({id: 1, name: 'Model', project_id, expected_project_id: 1})).rejects.toThrow();
        }
        expect((await state.pool!.query('SELECT project_id FROM pallet_models WHERE id=1')).rows[0].project_id).toBe(1);
        expect((await state.pool!.query('SELECT project_id FROM pallets')).rows).toEqual([{project_id: 1}]);
        expect((await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id')).rows).toEqual(before);
        expect((await state.pool!.query('SELECT * FROM fis_outbox')).rows).toEqual([]);
    });
    it('moves without renaming and keeps rename-only catalog calls compatible', async () => {
        state.auth = itUser;
        await state.pool!.query("INSERT INTO projects(id,name) VALUES(2,'Destination')");
        await UpdateModel({id: 1, name: 'Model', project_id: 2, expected_project_id: 1});
        expect((await state.pool!.query('SELECT project,model FROM pallet_details')).rows)
            .toEqual([{project: 'Destination', model: 'Model'}]);
        await UpdateModel({id: 1, name: 'Renamed model'});
        await UpdateProject({id: 2, name: 'Renamed project'});
        expect((await state.pool!.query('SELECT project,model FROM pallet_details')).rows)
            .toEqual([{project: 'Renamed project', model: 'Renamed model'}]);
        expect((await state.pool!.query('SELECT COUNT(*)::int AS count FROM fis_outbox')).rows[0].count).toBe(3);
        expect((await state.pool!.query("SELECT COUNT(*)::int AS count FROM pallet_audit_logs WHERE description LIKE '%audit_model_moved%'")).rows[0].count).toBe(1);
    });
    it('dynamically scopes station pallets, history and service statistics to the latest pallet machine', async () => {
        await state.pool!.query(`
            INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by,machine) VALUES
                ('COAT-01',1,1,100,1,'IT','COAT'), ('COAT-02',1,1,100,1,'IT','COAT'),
                ('SSM-01',1,1,100,1,'IT','SSM');
            INSERT INTO projects(id,name) VALUES(2,'Other project');
            INSERT INTO pallet_models(id,project_id,name) VALUES(2,2,'Other model');
            INSERT INTO pallets(pallet_id,project_id,model_id,max_cycles,nests,created_by,machine)
                VALUES('OTHER-COAT',2,2,100,1,'IT','COAT');
            INSERT INTO production_stations(station,pallet_id,updated_at) VALUES
                ('LUD047','PAL-01',NOW()-interval '3 minutes'),
                ('LUD047','SSM-01',NOW()-interval '2 minutes'),
                ('LUD047','COAT-01',NOW()-interval '1 minute');
            INSERT INTO pallet_service_periods(pallet_id,service_status,started_at,finished_at,completed) VALUES
                ('PAL-01','Washing_Required',NOW()-interval '10 minutes',NOW(),true),
                ('COAT-01','Washing_Required',NOW()-interval '20 minutes',NOW(),true),
                ('SSM-01','Washing_Required',NOW()-interval '30 minutes',NOW(),true)`);
        for (const [palletId, machine, ids, duration] of [
            ['COAT-01', 'COAT', ['COAT-01', 'COAT-02'], 20],
            ['PAL-01', 'WSM', ['PAL-01'], 10],
            ['SSM-01', 'SSM', ['SSM-01'], 30],
        ] as const) {
            await state.pool!.query('UPDATE production_stations SET updated_at=NOW() WHERE station=$1 AND pallet_id=$2', ['LUD047', palletId]);
            const dashboard = await GetPublicDashboard({station: 'lud047'});
            expect(dashboard.selected_station).toMatchObject({pallet_id: palletId, machine});
            expect(dashboard.pallets.map(p => p.pallet_id).sort()).toEqual([...ids]);
            expect(dashboard.station_history.every(entry => entry.machine === machine)).toBe(true);
            expect(dashboard.service.completed_30d).toBe(1);
            expect(dashboard.service.average_minutes_30d).toBe(duration);
            expect(dashboard.service.daily.reduce((sum, day) => sum + day.completed, 0)).toBe(1);
        }
        const all = await GetPublicDashboard({station: 'ALL'});
        expect(all.pallets).toHaveLength(5);
        expect(all.service.completed_30d).toBe(3);
        expect((await GetPublicDashboard({station: 'UNKNOWN'})).pallets).toEqual([]);
    });
    it('revokes manual operator sessions while preserving LDAP, APACS and audit history', async () => {
        await state.pool!.query(`INSERT INTO auth_sessions(token_hash,username,full_name,role,expires_at) VALUES
            ('manual-test','operator:someone','Manual','operator',NOW()+interval '1 hour'),
            ('ldap-test','anna','Anna Nowak','staff',NOW()+interval '1 hour'),
            ('apacs-test','apacs:17','Anna Nowak','operator',NOW()+interval '1 hour')`);
        const before = (await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id')).rows;
        await state.pool!.query(readFileSync(new URL('./migrations/9_revoke_manual_operator_sessions.up.sql', import.meta.url), 'utf8'));
        expect((await state.pool!.query('SELECT username FROM auth_sessions ORDER BY username')).rows)
            .toEqual([{username: 'anna'}, {username: 'apacs:17'}]);
        expect((await state.pool!.query('SELECT * FROM pallet_audit_logs ORDER BY id')).rows).toEqual(before);
    });
    it('attributes a card operator report to the APACS employee name', async () => {
        state.auth = {...operator, userID: 'apacs:17', fullName: 'Anna Nowak'};
        await CreateOperatorReport({pallet_id: 'PAL-01', kind: 'washing'});
        expect((await state.pool!.query('SELECT operator_id FROM operator_reports')).rows)
            .toEqual([{operator_id: 'Anna Nowak'}]);
        expect((await state.pool!.query("SELECT operator_id FROM pallet_audit_logs WHERE new_status='Washing_Required'")).rows)
            .toEqual([{operator_id: 'Anna Nowak'}]);
    });
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
        const {rows} = await GetReports({mode: 'history', previous_status: 'Damaged', statuses: 'Active'});
        expect(rows[0]?.damage_reason).toContain('Second');
        expect(rows[0]?.damage_reason).not.toContain('Repaired');
        const {history} = await GetPalletHistory({pallet_id: 'PAL-01'});
        expect(history.find(entry => entry.new_status === 'Damaged')?.status_reason).toContain('Second');
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
    });
    it('records a confirmed wash for an active pallet with zero cycles', async () => {
        state.auth = ur;
        await state.pool!.query("UPDATE pallets SET current_cycles=0,total_cycles=400,updated_at=NOW()-interval '1 second' WHERE pallet_id='PAL-01'");
        const scan = (await state.pool!.query("SELECT updated_at FROM pallets WHERE pallet_id='PAL-01'")).rows[0].updated_at.toISOString();
        const params = {pallet_id: 'PAL-01', expected_cycles: 0, expected_updated_at: scan, comment: 'Washed at zero'};
        const result = await confirmWashing(params);
        expect(result.reset).toBe(false);
        expect(result.pallet).toMatchObject({status: 'Active', current_cycles: 0, total_cycles: 400});
        await expect(confirmWashing(params)).rejects.toThrow(/changed|zmienił/);
        const logs = (await state.pool!.query("SELECT * FROM pallet_audit_logs WHERE pallet_id='PAL-01' ORDER BY id")).rows;
        expect(logs).toHaveLength(2);
        expect(logs[1]).toMatchObject({operator_id: 'UR A', previous_status: 'Active', new_status: 'Active'});
        expect(logs[1].description).toContain('audit_washing_confirmed');
        expect(logs[1].description).toContain('Washed at zero');
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
    it('filters report transitions before pagination and keeps deleted pallet history accessible to maintenance', async () => {
        const pallet = {pallet_id: 'PAL-01'};
        await state.pool!.query(`INSERT INTO pallet_audit_logs(pallet_id,operator_id,previous_status,new_status,description,timestamp) VALUES
            ('PAL-01','UR A','Washing_Required','Active','Washed first','2026-10-12T05:00:00Z'),
            ('PAL-01','UR A','Washing_Required','Active','Washed again','2026-10-12T06:00:00Z'),
            ('PAL-01','UR A','Damaged','Active','Repaired','2026-10-12T07:00:00Z'),
            ('PAL-01','UR A','Active','Active','Metadata update','2026-10-12T08:00:00Z'),
            ('PAL-01','UR A','Damaged','Damaged','Second defect','2026-10-12T09:00:00Z'),
            ('PAL-01','UR A','Washing_Required','Active','Outside date','2026-10-13T06:00:00Z');
            UPDATE pallets SET deleted_at=NOW() WHERE pallet_id='PAL-01'`);
        const filters = {mode: 'history' as const, previous_status: 'Washing_Required', statuses: 'Active',
            changes_only: true, from: '2026-10-12', to: '2026-10-12', limit: 1};
        const first = await GetReports(filters);
        expect(first.rows).toMatchObject([{...pallet, description: 'Washed again'}]);
        const next = await GetReports({...filters, before_timestamp: first.next_before_timestamp, before_id: first.next_before_id});
        expect(next.rows).toMatchObject([{...pallet, description: 'Washed first'}]);
        expect(next.next_offset).toBeUndefined();
        const changes = await GetReports({mode: 'history', changes_only: true, statuses: 'Active'});
        expect(changes.rows.map(row => row.description)).toEqual(['Outside date', 'Repaired', 'Washed again', 'Washed first']);
        const sameStatus = await GetReports({mode: 'history', previous_status: 'Damaged', statuses: 'Damaged'});
        expect(sameStatus.rows).toMatchObject([{description: 'Second defect'}]);
        const damaged = await GetReports({mode: 'history', statuses: 'Damaged'});
        expect(damaged.rows).toMatchObject([{previous_status: 'Damaged', description: 'Second defect'}]);
        const active = await GetReports({mode: 'history', statuses: 'Active'});
        expect(active.rows).toEqual(expect.arrayContaining([
            expect.objectContaining({previous_status: 'NEW'}),
            expect.objectContaining({previous_status: 'Active', description: 'Metadata update'}),
        ]));
        await expect(GetReports({...filters, previous_status: 'NEW'})).rejects.toThrow();

        await expect(GetPallet(pallet)).rejects.toThrow();
        await expect(GetPallet({...pallet, include_deleted: true})).resolves.toMatchObject({pallet});
        await expect(GetPalletHistory(pallet)).resolves.toMatchObject({history: expect.arrayContaining([expect.objectContaining({new_status: 'DELETED'})])});
        state.auth = operator;
        await expect(GetPallet({...pallet, include_deleted: true})).rejects.toThrow();
    });
    it('links historical Blocked badges to the reason for the matching block', async () => {
        state.auth = itUser;
        await UpdatePallet({pallet_id: 'PAL-01', status: 'Blocked', block_reason: 'First inspection'});
        await UpdatePallet({pallet_id: 'PAL-01', status: 'Blocked', nests: 2, block_reason: 'Corrected reason'});
        await UpdatePallet({pallet_id: 'PAL-01', nests: 3});
        await state.pool!.query(`INSERT INTO pallet_audit_logs(pallet_id,operator_id,previous_status,new_status,description)
            VALUES ('PAL-01','IT A','Blocked','Blocked','i18n:malformed')`);
        await UnblockPallet({pallet_id: 'PAL-01', comment: 'Inspection complete'});
        await BlockPallet({pallet_id: 'PAL-01', block_reason: 'Second inspection'});

        const {rows} = await GetReports({mode: 'history', changes_only: true, acceptLanguage: 'en'});
        expect(rows.map(({previous_status, status, block_reason}) => [previous_status, status, block_reason])).toEqual([
            ['Active', 'Blocked', 'Second inspection'],
            ['Blocked', 'Active', 'Corrected reason'],
            ['Active', 'Blocked', 'First inspection'],
        ]);
        const revisions = await GetReports({mode: 'history', previous_status: 'Blocked', statuses: 'Blocked', acceptLanguage: 'en'});
        expect(revisions.rows).toMatchObject([
            {description: 'i18n:malformed', block_reason: 'Corrected reason'},
            {description: 'Pallet data changed: nests 2 → 3.', block_reason: 'Corrected reason'},
            {block_reason: 'Corrected reason', previous_block_reason: 'First inspection'},
        ]);
        const {history} = await GetPalletHistory({pallet_id: 'PAL-01'});
        expect(history.filter(entry => entry.status_reason).map(entry => entry.status_reason)).toEqual([
            'Second inspection', 'Corrected reason', 'First inspection',
        ]);
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
