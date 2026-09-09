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
    UpdateProject(params: {id: number; name: ShortText; acceptLanguage?: string}, options?: {authData?: AuthData}): Promise<void>;
    DeleteProject(params: {id: number; acceptLanguage?: string}, options?: {authData?: AuthData}): Promise<void>;
    UpdateModel(params: {id: number; name: ShortText; acceptLanguage?: string}, options?: {authData?: AuthData}): Promise<void>;
    DeleteModel(params: {id: number; acceptLanguage?: string}, options?: {authData?: AuthData}): Promise<void>;
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
            cycle_step_every?: number;
            cycle_step_amount?: MaxCycles;
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
    it('renames catalogue entries by ID, updates pallets and queues FIS synchronization', async () => {
        await seedCatalog();
        await addPallet('CATALOG-USED');
        const project = (await pallet.GetAllProjects()).projects[0];
        const model = (await catalogClient.GetAllModels()).models[0];
        await catalogClient.UpdateProject({id: project.id, name: shortText('PROJECT-B')}, callOptions);
        await catalogClient.UpdateModel({id: model.id, name: shortText('MODEL-B')}, callOptions);
        expect((await catalogClient.GetAllModels()).models).toEqual([{...model, project: 'PROJECT-B', name: 'MODEL-B'}]);
        expect(await db.queryRow`SELECT project_id, model_id, project, model FROM pallet_details WHERE pallet_id = 'CATALOG-USED'`)
            .toEqual({project_id: project.id, model_id: model.id, project: 'PROJECT-B', model: 'MODEL-B'});
        expect(await db.queryRow`SELECT payload->'details'->>'model' AS model FROM fis_outbox ORDER BY id DESC LIMIT 1`)
            .toEqual({model: 'MODEL-B'});
        await expect(catalogClient.DeleteProject({id: project.id}, callOptions)).rejects.toThrow();
        await expect(catalogClient.DeleteModel({id: model.id}, callOptions)).rejects.toThrow();
    });

    it('keeps archived pallet references and rejects mismatched project/model IDs', async () => {
        await seedCatalog();
        await seedCatalog('PROJECT-B', 'MODEL-B');
        await addPallet('ARCHIVED-CATALOG');
        const [modelA, modelB] = (await catalogClient.GetAllModels()).models;
        await expect(db.exec`UPDATE pallets SET model_id = ${modelB.id} WHERE pallet_id = 'ARCHIVED-CATALOG'`).rejects.toThrow();
        await db.exec`UPDATE pallets SET deleted_at = NOW() WHERE pallet_id = 'ARCHIVED-CATALOG'`;
        await catalogClient.UpdateModel({id: modelA.id, name: shortText('MODEL-RENAMED')}, callOptions);
        expect(await db.queryRow`SELECT model, model_id FROM pallet_details WHERE pallet_id = 'ARCHIVED-CATALOG'`)
            .toEqual({model: 'MODEL-RENAMED', model_id: modelA.id});
        await expect(catalogClient.DeleteModel({id: modelA.id}, callOptions)).rejects.toThrow();
    });

    it('deletes unused models and projects and rejects unauthorized changes', async () => {
        await seedCatalog();
        const project = (await pallet.GetAllProjects()).projects[0];
        const model = (await catalogClient.GetAllModels()).models[0];
        await expect(catalogClient.UpdateProject({id: project.id, name: shortText('DENIED')}, {
            authData: {...managementUser, hasITDepartmentAccess: false},
        })).rejects.toThrow();
        await expect(catalogClient.DeleteProject({id: project.id}, callOptions)).rejects.toThrow();
        await catalogClient.DeleteModel({id: model.id}, callOptions);
        await catalogClient.DeleteProject({id: project.id}, callOptions);
        expect(await pallet.GetAllProjects()).toEqual({projects: []});
    });

    it('serves project-scoped models through the catalog endpoints', async () => {
        await seedCatalog();

        await expect(catalogClient.AddModel(
            {project: shortText('project-a'), name: shortText('model-a'), acceptLanguage: 'en'},
            callOptions,
        )).rejects.toThrow();

        await expect(catalogClient.GetAllModels()).resolves.toEqual({
            models: [{id: expect.any(Number), project_id: expect.any(Number), project: 'PROJECT-A', name: 'MODEL-A'}],
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

    it('counts each cycle request and enforces the washing limit', async () => {
        await seedCatalog();
        await addPallet('PALLET-CYCLES', 'MODEL-A', 2);
        const request = {pallet_id: 'PALLET-CYCLES', station: 'SOLDER-01'};
        expect(await fis.RegisterSolderingCycle(request)).toMatchObject({current_cycles: 1, total_cycles: 1, pallet_status: 'Active'});
        expect(await fis.RegisterSolderingCycle(request)).toMatchObject({current_cycles: 2, total_cycles: 2, pallet_status: 'Washing_Required'});
        await expect(fis.RegisterSolderingCycle(request)).rejects.toMatchObject({code: 'failed_precondition'});
        expect(await db.queryRow`SELECT new_status FROM pallet_audit_logs WHERE pallet_id = 'PALLET-CYCLES' AND new_status = 'Washing_Required' LIMIT 1`)
            .toEqual({new_status: 'Washing_Required'});
    });

    it('does not lose concurrent cycle increments', async () => {
        await seedCatalog();
        await addPallet('PALLET-CONCURRENT', 'MODEL-A', 100);
        await Promise.all(Array.from({length: 20}, () => fis.RegisterSolderingCycle({
            pallet_id: 'PALLET-CONCURRENT', station: 'SOLDER-01',
        })));
        expect(await db.queryRow`SELECT current_cycles, total_cycles FROM pallets WHERE pallet_id = 'PALLET-CONCURRENT'`)
            .toEqual({current_cycles: 20, total_cycles: 20});
    });

    it('updates the station assignment with a completed cycle', async () => {
        await seedCatalog();
        await addPallet('PALLET-PREVIOUS', 'MODEL-A', 20);
        await addPallet('PALLET-CURRENT', 'MODEL-A', 20);
        await stationClient.SetSolderingStationPallet({station: 'SOLDER-01', pallet_id: 'PALLET-PREVIOUS'});
        await fis.RegisterSolderingCycle({station: 'SOLDER-01', pallet_id: 'PALLET-CURRENT'});
        expect(await db.queryRow`SELECT pallet_id FROM production_stations WHERE station = 'SOLDER-01'`)
            .toEqual({pallet_id: 'PALLET-CURRENT'});
    });

    it('rejects invalid identifiers and leaves rejected cycles unchanged', async () => {
        await expect(fis.RegisterSolderingCycle({pallet_id: 'INVALID PALLET ID', station: 'SOLDER-01'}))
            .rejects.toMatchObject({details: {reason: 'INVALID_PALLET_ID'}});
        await expect(fis.RegisterSolderingCycle({pallet_id: 'PALLET-DAMAGED', station: 'ALL'}))
            .rejects.toMatchObject({details: {reason: 'INVALID_STATION'}});
        await seedCatalog();
        await addPallet('PALLET-DAMAGED', 'MODEL-A', 20);
        await db.exec`UPDATE pallets SET status = 'Damaged' WHERE pallet_id = 'PALLET-DAMAGED'`;
        await expect(fis.RegisterSolderingCycle({pallet_id: 'PALLET-DAMAGED', station: 'SOLDER-01'}))
            .rejects.toMatchObject({details: {reason: 'PALLET_NOT_ACTIVE'}});
        expect(await db.queryRow`SELECT current_cycles FROM pallets WHERE pallet_id = 'PALLET-DAMAGED'`)
            .toEqual({current_cycles: 0});
        expect(await db.queryRow`SELECT COUNT(*)::int AS assignments FROM production_stations`)
            .toEqual({assignments: 0});
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
            cycle_step_every: 2,
            cycle_step_amount: maxCycles(10),
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
        expect(await db.queryAll<{pallet_id: string; max_cycles: number}>`
            SELECT pallet_id, max_cycles FROM pallets WHERE pallet_id LIKE 'RANGE-%' ORDER BY pallet_id
        `).toEqual([
            {pallet_id: 'RANGE-01', max_cycles: 200},
            {pallet_id: 'RANGE-02', max_cycles: 200},
            {pallet_id: 'RANGE-03', max_cycles: 210},
        ]);

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
