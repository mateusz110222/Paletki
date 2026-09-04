import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {fis, pallet} from '~encore/clients';
import type {AuthData} from '../shared/auth-data';
import type {FisUnit, MaxCycles, NestCount, PalletID, ShortText} from '../shared/validation';
import type {PalletModel} from '../shared/types';
import {config} from '../config';
import {db} from './db';

const managementUser: AuthData = {
    userID: 'integration.user',
    fullName: 'Integration User',
    department: 'IT',
    title: 'Test',
    hasITDepartmentAccess: true,
    hasURDepartmentAccess: false,
    hasMEDepartmentAccess: false,
    sessionHash: 'integration-test-session',
};
const callOptions = {authData: managementUser};

type CatalogClient = {
    AddModel(
        params: {project: ShortText; name: ShortText; acceptLanguage?: string},
        options?: {authData?: AuthData},
    ): Promise<void>;
    GetAllModels(options?: {authData?: AuthData}): Promise<{models: PalletModel[]}>;
};
const catalogClient = pallet as typeof pallet & CatalogClient;
type StationClient = {
    SetSolderingStationPallet(params: {station: string; pallet_id: string}): Promise<{
        status: true;
        station: string;
        pallet_id: string;
        project: string;
        model: string;
        updated_at: string;
    }>;
};
const stationClient = fis as typeof fis & StationClient;
type PalletRangeClient = {
    AddPalletRange(
        params: {
            first_pallet_id: PalletID;
            last_pallet_id: PalletID;
            project: ShortText;
            model: ShortText;
            max_cycles: MaxCycles;
            nests: NestCount;
            status: 'Active';
            fis: FisUnit;
            acceptLanguage?: string;
        },
        options?: {authData?: AuthData},
    ): Promise<{status: true; pallet_ids: string[]; created: number}>;
};
const rangeClient = pallet as typeof pallet & PalletRangeClient;

const shortText = (value: string) => value as ShortText;
const palletId = (value: string) => value as PalletID;
const maxCycles = (value: number) => value as MaxCycles;
const nests = (value: number) => value as NestCount;
const fisUnit = (value: 1 | 2) => value as FisUnit;

async function seedCatalog(project = 'PROJECT-A', model = 'MODEL-A'): Promise<void> {
    await pallet.AddProject({name: shortText(project), acceptLanguage: 'en'}, callOptions);
    await catalogClient.AddModel(
        {project: shortText(project), name: shortText(model), acceptLanguage: 'en'},
        callOptions,
    );
}

async function addPallet(id: string, model = 'MODEL-A', cycles = 2): Promise<void> {
    await pallet.AddPallet({
        pallet_id: palletId(id),
        project: shortText('PROJECT-A'),
        model: shortText(model),
        max_cycles: maxCycles(cycles),
        nests: nests(2),
        status: 'Active',
        fis: fisUnit(1),
        acceptLanguage: 'en',
    }, callOptions);
}

async function addPalletForProject(id: string, project: string, model: string): Promise<void> {
    await pallet.AddPallet({
        pallet_id: palletId(id),
        project: shortText(project),
        model: shortText(model),
        max_cycles: maxCycles(200),
        nests: nests(2),
        status: 'Active',
        fis: fisUnit(1),
        acceptLanguage: 'en',
    }, callOptions);
}

beforeEach(async () => {
    await db.exec`DROP TRIGGER IF EXISTS test_reject_outbox_insert ON fis_outbox`;
    await db.exec`DROP FUNCTION IF EXISTS test_reject_outbox_insert()`;
    await db.exec`
        TRUNCATE TABLE production_stations, soldering_cycle_events, pallet_audit_logs, fis_outbox, pallets, pallet_models, projects
        RESTART IDENTITY CASCADE
    `;
    await db.exec`
        UPDATE fis_reconciliation_state
        SET last_pallet_id = 0, updated_at = NOW()
        WHERE singleton = TRUE
    `;
});

afterEach(async () => {
    await db.exec`DROP TRIGGER IF EXISTS test_reject_outbox_insert ON fis_outbox`;
    await db.exec`DROP FUNCTION IF EXISTS test_reject_outbox_insert()`;
});

describe('PostgreSQL pallet integration', () => {
    it('serves project-scoped models through the catalog endpoints', async () => {
        await seedCatalog();

        await expect(catalogClient.AddModel(
            {project: shortText('project-a'), name: shortText('model-a'), acceptLanguage: 'en'},
            callOptions,
        )).rejects.toThrow();

        await expect(catalogClient.GetAllModels()).resolves.toEqual({
            models: [{project: 'PROJECT-A', name: 'MODEL-A'}],
        });
    });

    it('validates the model and commits a pallet with its outbox event atomically', async () => {
        await seedCatalog();

        await expect(addPallet('INVALID-MODEL', 'MODEL-X')).rejects.toThrow();
        expect((await db.queryRow<{count: number}>`
            SELECT COUNT(*)::int AS count FROM pallets WHERE pallet_id = 'INVALID-MODEL'
        `)?.count).toBe(0);

        await addPallet('PALLET-OK');
        const committed = await db.queryRow<{pallets: number; jobs: number}>`
            SELECT
                (SELECT COUNT(*)::int FROM pallets WHERE pallet_id = 'PALLET-OK') AS pallets,
                (SELECT COUNT(*)::int FROM fis_outbox WHERE pallet_id = 'PALLET-OK') AS jobs
        `;
        expect(committed).toEqual({pallets: 1, jobs: 1});

        await db.exec`
            CREATE FUNCTION test_reject_outbox_insert()
            RETURNS trigger AS $$
            BEGIN
                IF NEW.pallet_id = 'PALLET-ROLLBACK' THEN
                    RAISE EXCEPTION 'intentional outbox failure';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `;
        await db.exec`
            CREATE TRIGGER test_reject_outbox_insert
            BEFORE INSERT ON fis_outbox
            FOR EACH ROW EXECUTE FUNCTION test_reject_outbox_insert()
        `;

        await expect(addPallet('PALLET-ROLLBACK')).rejects.toThrow();
        expect((await db.queryRow<{count: number}>`
            SELECT COUNT(*)::int AS count FROM pallets WHERE pallet_id = 'PALLET-ROLLBACK'
        `)?.count).toBe(0);
    });

    it('runs the cycle-limit trigger and writes the resulting audit entry', async () => {
        await seedCatalog();
        await addPallet('PALLET-CYCLES', 'MODEL-A', 2);

        const firstEvent = {
            event_id: '1'.repeat(64),
            station: 'SOLDER-01',
            process: 'PROCESS-A',
            unit_ids: ['UNIT-001'],
        };
        const secondEvent = {
            event_id: '2'.repeat(64),
            station: 'SOLDER-01',
            process: 'PROCESS-A',
            unit_ids: ['UNIT-002'],
        };
        const first = await fis.RegisterSolderingCycle({pallet_id: 'PALLET-CYCLES', ...firstEvent});
        const second = await fis.RegisterSolderingCycle({pallet_id: 'PALLET-CYCLES', ...secondEvent});
        const duplicate = await fis.RegisterSolderingCycle({pallet_id: 'PALLET-CYCLES', ...firstEvent});

        expect(first).toMatchObject({cycle_recorded: true, current_cycles: 1, pallet_status: 'Active'});
        expect(duplicate).toMatchObject({cycle_recorded: false, current_cycles: 1, pallet_status: 'Active'});
        expect(second).toMatchObject({cycle_recorded: true, current_cycles: 2, pallet_status: 'Washing_Required'});
        expect(await db.queryRow<{events: number}>`
            SELECT COUNT(*)::int AS events
            FROM soldering_cycle_events
            WHERE pallet_id = 'PALLET-CYCLES'
        `).toEqual({events: 2});
        expect(await db.queryRow<{unit_ids_type: string; unit_ids: string[]}>`
            SELECT jsonb_typeof(unit_ids) AS unit_ids_type, unit_ids
            FROM soldering_cycle_events
            WHERE event_id = ${firstEvent.event_id}
        `).toEqual({unit_ids_type: 'array', unit_ids: ['UNIT-001']});
        const audit = await db.queryRow<{previous_status: string; new_status: string; description: string}>`
            SELECT previous_status, new_status, description
            FROM pallet_audit_logs
            WHERE pallet_id = 'PALLET-CYCLES' AND new_status = 'Washing_Required'
            ORDER BY id DESC LIMIT 1
        `;
        expect(audit).toMatchObject({previous_status: 'Active', new_status: 'Washing_Required'});
        expect(audit?.description).toContain('audit_cycle_limit');
    });

    it('rejects reuse of a cycle event ID with different canonical metadata', async () => {
        await seedCatalog();
        await addPallet('PALLET-EVENT-A', 'MODEL-A', 20);
        await addPallet('PALLET-EVENT-B', 'MODEL-A', 20);
        const original = {
            event_id: 'a'.repeat(64),
            station: 'SOLDER-01',
            process: 'PROCESS-A',
            unit_ids: ['UNIT-002', 'UNIT-001'],
        };
        await fis.RegisterSolderingCycle({pallet_id: 'PALLET-EVENT-A', ...original});

        await expect(fis.RegisterSolderingCycle({
            pallet_id: 'PALLET-EVENT-A',
            ...original,
            station: 'SOLDER-02',
        })).rejects.toMatchObject({
            code: 'already_exists',
            details: {reason: 'CYCLE_EVENT_METADATA_CONFLICT'},
        });
        await expect(fis.RegisterSolderingCycle({
            pallet_id: 'PALLET-EVENT-A',
            ...original,
            process: 'PROCESS-B',
        })).rejects.toMatchObject({
            code: 'already_exists',
            details: {reason: 'CYCLE_EVENT_METADATA_CONFLICT'},
        });
        await expect(fis.RegisterSolderingCycle({
            pallet_id: 'PALLET-EVENT-A',
            ...original,
            unit_ids: ['UNIT-003'],
        })).rejects.toMatchObject({
            code: 'already_exists',
            details: {reason: 'CYCLE_EVENT_METADATA_CONFLICT'},
        });
        await expect(fis.RegisterSolderingCycle({
            pallet_id: 'PALLET-EVENT-B',
            ...original,
        })).rejects.toMatchObject({
            code: 'already_exists',
            details: {reason: 'CYCLE_EVENT_METADATA_CONFLICT'},
        });

        const canonicalReplay = await fis.RegisterSolderingCycle({
            pallet_id: 'pallet-event-a',
            ...original,
            station: 'solder-01',
            process: 'process-a',
            unit_ids: ['unit-001', 'unit-002'],
        });
        expect(canonicalReplay).toMatchObject({cycle_recorded: false, current_cycles: 1, total_cycles: 1});
        expect((await fis.GetSolderingPallet({pallet_id: 'PALLET-EVENT-B'})).current_cycles).toBe(0);
    });

    it('increments only once when the same cycle event arrives concurrently', async () => {
        await seedCatalog();
        await addPallet('PALLET-SAME-EVENT', 'MODEL-A', 100);
        const event = {
            event_id: 'b'.repeat(64),
            station: 'SOLDER-01',
            process: 'PROCESS-A',
            unit_ids: ['UNIT-001'],
        };

        const results = await Promise.all(Array.from(
            {length: 12},
            () => fis.RegisterSolderingCycle({pallet_id: 'PALLET-SAME-EVENT', ...event}),
        ));

        expect(results.filter((result) => result.cycle_recorded)).toHaveLength(1);
        expect(results.every((result) => result.current_cycles === 1 && result.total_cycles === 1)).toBe(true);
        expect(await db.queryRow<{cycles: number; events: number}>`
            SELECT
                (SELECT current_cycles FROM pallets WHERE pallet_id = 'PALLET-SAME-EVENT') AS cycles,
                (SELECT COUNT(*)::int FROM soldering_cycle_events WHERE pallet_id = 'PALLET-SAME-EVENT') AS events
        `).toEqual({cycles: 1, events: 1});
    });

    it('does not lose updates for different concurrent cycle events', async () => {
        await seedCatalog();
        await addPallet('PALLET-MANY-EVENTS', 'MODEL-A', 100);
        const eventCount = 20;

        const results = await Promise.all(Array.from({length: eventCount}, (_, index) => (
            fis.RegisterSolderingCycle({
                pallet_id: 'PALLET-MANY-EVENTS',
                event_id: (index + 1).toString(16).padStart(64, '0'),
                station: 'SOLDER-01',
                process: 'PROCESS-A',
                unit_ids: [`UNIT-${String(index + 1).padStart(3, '0')}`],
            })
        )));

        expect(results.every((result) => result.cycle_recorded)).toBe(true);
        expect(await db.queryRow<{current_cycles: number; total_cycles: number; events: number}>`
            SELECT current_cycles,
                   total_cycles,
                   (SELECT COUNT(*)::int FROM soldering_cycle_events WHERE pallet_id = pallets.pallet_id) AS events
            FROM pallets
            WHERE pallet_id = 'PALLET-MANY-EVENTS'
        `).toEqual({current_cycles: eventCount, total_cycles: eventCount, events: eventCount});
    });

    it('reasserts the station assignment in the successful cycle transaction', async () => {
        await seedCatalog();
        await addPallet('PALLET-PREVIOUS', 'MODEL-A', 20);
        await addPallet('PALLET-CURRENT', 'MODEL-A', 20);
        await stationClient.SetSolderingStationPallet({
            station: 'SOLDER-01',
            pallet_id: 'PALLET-PREVIOUS',
        });

        await fis.RegisterSolderingCycle({
            pallet_id: 'PALLET-CURRENT',
            event_id: 'e'.repeat(64),
            station: 'SOLDER-01',
            process: 'PROCESS-A',
            unit_ids: ['UNIT-001'],
        });

        expect(await db.queryRow<{pallet_id: string; state: string; result_current_cycles: number}>`
            SELECT stations.pallet_id, events.state, events.result_current_cycles
            FROM production_stations stations
            JOIN soldering_cycle_events events
              ON events.station = stations.station AND events.pallet_id = stations.pallet_id
            WHERE stations.station = 'SOLDER-01' AND events.event_id = ${'e'.repeat(64)}
        `).toEqual({pallet_id: 'PALLET-CURRENT', state: 'recorded', result_current_cycles: 1});
    });

    it('rejects invalid pallet IDs before writing a cycle event', async () => {
        await expect(fis.RegisterSolderingCycle({
            pallet_id: 'INVALID PALLET ID',
            event_id: 'c'.repeat(64),
            station: 'SOLDER-01',
            process: 'PROCESS-A',
            unit_ids: ['UNIT-001'],
        })).rejects.toMatchObject({
            code: 'invalid_argument',
            details: {reason: 'INVALID_PALLET_ID'},
        });
        expect((await db.queryRow<{events: number}>`
            SELECT COUNT(*)::int AS events FROM soldering_cycle_events
        `)?.events).toBe(0);
    });

    it('rejects an invalid cycle event ID before opening an event claim', async () => {
        await expect(fis.RegisterSolderingCycle({
            pallet_id: 'PALLET-VALID',
            event_id: 'not-a-64-character-hex-id',
            station: 'SOLDER-01',
            process: 'PROCESS-A',
            unit_ids: ['UNIT-001'],
        })).rejects.toMatchObject({
            code: 'invalid_argument',
            details: {reason: 'INVALID_CYCLE_EVENT_ID'},
        });
        expect((await db.queryRow<{events: number}>`
            SELECT COUNT(*)::int AS events FROM soldering_cycle_events
        `)?.events).toBe(0);
    });

    it('rolls back the event claim and station assignment when a cycle is rejected', async () => {
        await seedCatalog();
        await addPallet('PALLET-DAMAGED', 'MODEL-A', 20);
        await db.exec`UPDATE pallets SET status = 'Damaged' WHERE pallet_id = 'PALLET-DAMAGED'`;
        const eventId = 'd'.repeat(64);

        await expect(fis.RegisterSolderingCycle({
            pallet_id: 'PALLET-DAMAGED',
            event_id: eventId,
            station: 'SOLDER-01',
            process: 'PROCESS-A',
            unit_ids: ['UNIT-001'],
        })).rejects.toMatchObject({
            code: 'failed_precondition',
            details: {reason: 'PALLET_NOT_ACTIVE'},
        });

        expect(await db.queryRow<{events: number; assignments: number; cycles: number}>`
            SELECT
                (SELECT COUNT(*)::int FROM soldering_cycle_events WHERE event_id = ${eventId}) AS events,
                (SELECT COUNT(*)::int FROM production_stations WHERE station = 'SOLDER-01') AS assignments,
                (SELECT current_cycles FROM pallets WHERE pallet_id = 'PALLET-DAMAGED') AS cycles
        `).toEqual({events: 0, assignments: 0, cycles: 0});
    });

    it('does not assign an inactive pallet to a soldering station', async () => {
        await seedCatalog();
        await addPallet('PALLET-INACTIVE', 'MODEL-A', 20);
        await db.exec`UPDATE pallets SET status = 'Washing_Required' WHERE pallet_id = 'PALLET-INACTIVE'`;

        await expect(stationClient.SetSolderingStationPallet({
            station: 'SOLDER-01',
            pallet_id: 'PALLET-INACTIVE',
        })).rejects.toMatchObject({
            code: 'failed_precondition',
            details: {reason: 'PALLET_NOT_ACTIVE'},
        });
        expect((await db.queryRow<{assignments: number}>`
            SELECT COUNT(*)::int AS assignments FROM production_stations
        `)?.assignments).toBe(0);
    });

    it('creates a two-digit pallet range and its FIS jobs atomically', async () => {
        await seedCatalog();
        const result = await rangeClient.AddPalletRange({
            first_pallet_id: palletId('RANGE-01'),
            last_pallet_id: palletId('RANGE-03'),
            project: shortText('PROJECT-A'),
            model: shortText('MODEL-A'),
            max_cycles: maxCycles(200),
            nests: nests(2),
            status: 'Active',
            fis: fisUnit(1),
            acceptLanguage: 'en',
        }, callOptions);
        expect(result).toMatchObject({created: 3, pallet_ids: ['RANGE-01', 'RANGE-02', 'RANGE-03']});
        expect(await db.queryRow<{pallets: number; jobs: number}>`
            SELECT
                (SELECT COUNT(*)::int FROM pallets WHERE pallet_id LIKE 'RANGE-%') AS pallets,
                (SELECT COUNT(*)::int FROM fis_outbox WHERE pallet_id LIKE 'RANGE-%') AS jobs
        `).toEqual({pallets: 3, jobs: 3});

        await expect(rangeClient.AddPalletRange({
            first_pallet_id: palletId('RANGE-03'),
            last_pallet_id: palletId('RANGE-04'),
            project: shortText('PROJECT-A'),
            model: shortText('MODEL-A'),
            max_cycles: maxCycles(200),
            nests: nests(2),
            status: 'Active',
            fis: fisUnit(1),
            acceptLanguage: 'en',
        }, callOptions)).rejects.toThrow();
        expect((await db.queryRow<{count: number}>`
            SELECT COUNT(*)::int AS count FROM pallets WHERE pallet_id = 'RANGE-04'
        `)?.count).toBe(0);
    });

    it('records the active station pallet and scopes its public dashboard to that project', async () => {
        await seedCatalog();
        await addPallet('PALLET-STATION');

        const assignment = await stationClient.SetSolderingStationPallet({
            station: 'solder-01',
            pallet_id: 'pallet-station',
        });
        expect(assignment).toMatchObject({
            status: true,
            station: 'SOLDER-01',
            pallet_id: 'PALLET-STATION',
            project: 'PROJECT-A',
        });

        const selection = await pallet.GetPublicDashboard({});
        expect(selection.scope).toBe('selection');
        expect(selection.selected_station).toBeNull();
        expect(selection.pallets).toEqual([]);
        expect(selection.stations).toHaveLength(1);

        const dashboard = await pallet.GetPublicDashboard({station: 'solder-01'});
        expect(dashboard.scope).toBe('station');
        expect(dashboard.selected_station?.station).toBe('SOLDER-01');
        expect(dashboard.station_history.map((entry) => entry.pallet_id)).toEqual(['PALLET-STATION']);
        expect(dashboard.pallets.map((entry) => entry.pallet_id)).toContain('PALLET-STATION');

        const allProjects = await pallet.GetPublicDashboard({station: 'ALL'});
        expect(allProjects.scope).toBe('all');
        expect(allProjects.selected_station).toBeNull();
        expect(allProjects.pallets.map((entry) => entry.pallet_id)).toContain('PALLET-STATION');

        await pallet.DeletePallet({pallet_id: 'PALLET-STATION', acceptLanguage: 'en'}, callOptions);
        expect((await pallet.GetPublicDashboard({})).stations).toEqual([]);
    });

    it('keeps the three most recent unique projects for each production station', async () => {
        for (let index = 1; index <= 4; index += 1) {
            const project = `PROJECT-${index}`;
            const model = `MODEL-${index}`;
            await seedCatalog(project, model);
            await addPalletForProject(`PALLET-${index}`, project, model);
            await stationClient.SetSolderingStationPallet({station: 'SOLDER-01', pallet_id: `PALLET-${index}`});
        }

        const firstDashboard = await pallet.GetPublicDashboard({station: 'SOLDER-01'});
        expect(firstDashboard.station_history).toHaveLength(3);
        expect(firstDashboard.selected_station?.project).toBe('PROJECT-4');
        expect(firstDashboard.station_history.map((entry) => entry.project)).not.toContain('PROJECT-1');
        expect(new Set(firstDashboard.station_history.map((entry) => entry.project)).size).toBe(3);

        await addPalletForProject('PALLET-3B', 'PROJECT-3', 'MODEL-3');
        await stationClient.SetSolderingStationPallet({station: 'SOLDER-01', pallet_id: 'PALLET-3B'});

        const refreshedDashboard = await pallet.GetPublicDashboard({station: 'SOLDER-01'});
        expect(refreshedDashboard.station_history).toHaveLength(3);
        expect(refreshedDashboard.selected_station).toMatchObject({
            project: 'PROJECT-3',
            pallet_id: 'PALLET-3B',
        });
        expect(refreshedDashboard.station_history.filter((entry) => entry.project === 'PROJECT-3')).toHaveLength(1);
        expect((await db.queryRow<{count: number}>`
            SELECT COUNT(*)::int AS count FROM production_stations WHERE station = 'SOLDER-01'
        `)?.count).toBe(3);
    });

    it('prunes completed outbox records beyond the configured retention', async () => {
        const ageInDays = config.fis.outboxCompletedRetentionDays + 1;
        await db.exec`
            INSERT INTO fis_outbox (
                idempotency_key, pallet_id, operation, payload, status, processed_at
            ) VALUES (
                md5('completed-retention-test')::uuid,
                'OLD-JOB',
                'DELETE',
                '{"fis":1,"pallet_id":"OLD-JOB"}'::jsonb,
                'completed',
                NOW() - (${ageInDays} * INTERVAL '1 day')
            )
        `;

        const result = await pallet.ProcessFisOutbox({limit: 1});
        expect(result).toMatchObject({claimed: 0, pruned: 1});
        expect((await db.queryRow<{count: number}>`
            SELECT COUNT(*)::int AS count FROM fis_outbox WHERE pallet_id = 'OLD-JOB'
        `)?.count).toBe(0);
    });
});
