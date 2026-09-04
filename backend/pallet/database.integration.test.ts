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

beforeEach(async () => {
    await db.exec`DROP TRIGGER IF EXISTS test_reject_outbox_insert ON fis_outbox`;
    await db.exec`DROP FUNCTION IF EXISTS test_reject_outbox_insert()`;
    await db.exec`
        TRUNCATE TABLE production_stations, pallet_audit_logs, fis_outbox, pallets, pallet_models, projects
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

        const first = await fis.RegisterSolderingCycle({pallet_id: 'PALLET-CYCLES'});
        const second = await fis.RegisterSolderingCycle({pallet_id: 'PALLET-CYCLES'});

        expect(first).toMatchObject({current_cycles: 1, pallet_status: 'Active'});
        expect(second).toMatchObject({current_cycles: 2, pallet_status: 'Washing_Required'});
        const audit = await db.queryRow<{previous_status: string; new_status: string; description: string}>`
            SELECT previous_status, new_status, description
            FROM pallet_audit_logs
            WHERE pallet_id = 'PALLET-CYCLES' AND new_status = 'Washing_Required'
            ORDER BY id DESC LIMIT 1
        `;
        expect(audit).toMatchObject({previous_status: 'Active', new_status: 'Washing_Required'});
        expect(audit?.description).toContain('audit_cycle_limit');
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
        expect(dashboard.pallets.map((entry) => entry.pallet_id)).toContain('PALLET-STATION');

        const allProjects = await pallet.GetPublicDashboard({station: 'ALL'});
        expect(allProjects.scope).toBe('all');
        expect(allProjects.selected_station).toBeNull();
        expect(allProjects.pallets.map((entry) => entry.pallet_id)).toContain('PALLET-STATION');

        await pallet.DeletePallet({pallet_id: 'PALLET-STATION', acceptLanguage: 'en'}, callOptions);
        expect((await pallet.GetPublicDashboard({})).stations).toEqual([]);
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
