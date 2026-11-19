import {api, APIError, Header} from "encore.dev/api";
import {config} from "../config";
import {requireLabUser} from "../shared/authorization";
import {t} from "../shared/i18n";
import {normalizePalletId} from "../shared/validation";
import {db} from "./db";
import {validReportDate} from "./reports";

export type StrainStatus = "missing" | "expired" | "due_soon" | "current";

export interface StrainPallet {
    pallet_id: string;
    project: string;
    model: string;
    measured_on: string | null;
    due_on: string | null;
    strain_status: StrainStatus;
}

interface StrainMeasurement {
    measured_on: string;
    recorded_at: string;
    recorded_by: string;
}

interface LocalizedRequest {
    acceptLanguage?: Header<"Accept-Language">;
}

interface StrainPalletParams extends LocalizedRequest {
    pallet_id: string;
}

interface RecordStrainParams extends StrainPalletParams {
    measured_on: string;
}

export const GetStrainPallets = api(
    {method: "GET", path: "/pallets/strain/measurements", expose: true, auth: true},
    async (params: LocalizedRequest): Promise<{pallets: StrainPallet[]; today: string; blocking: boolean}> => {
        requireLabUser(params.acceptLanguage);
        const today = await db.queryRow<{today: string}>`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS today`;
        const pallets = await db.queryAll<StrainPallet>`
            SELECT pallet_id, project, model, to_char(measured_on, 'YYYY-MM-DD') AS measured_on,
                   to_char(due_on, 'YYYY-MM-DD') AS due_on, strain_status
            FROM pallet_strain_status
            ORDER BY due_on NULLS FIRST, pallet_id
        `;
        return {pallets, today: today!.today, blocking: config.fis.strainBlocking};
    },
);

export const GetStrainHistory = api(
    {method: "GET", path: "/pallets/strain/measurements/:pallet_id", expose: true, auth: true},
    async ({pallet_id, acceptLanguage}: StrainPalletParams): Promise<{measurements: StrainMeasurement[]}> => {
        requireLabUser(acceptLanguage);
        const measurements = await db.queryAll<StrainMeasurement>`
            SELECT to_char(m.measured_on, 'YYYY-MM-DD') AS measured_on, m.recorded_by,
                   to_char(m.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS recorded_at
            FROM pallet_strain_measurements m
            JOIN pallets p ON p.id = m.pallet_id AND p.created_at = m.pallet_created_at
            WHERE p.pallet_id = ${normalizePalletId(pallet_id)} AND p.deleted_at IS NULL
            ORDER BY m.measured_on DESC
        `;
        return {measurements};
    },
);

interface BatchStrainParams extends LocalizedRequest {
    pallet_ids: string[];
    measured_on: string;
}

const MAX_STRAIN_BATCH_SIZE = 500;

async function recordMeasurements({pallet_ids, measured_on, acceptLanguage}: BatchStrainParams): Promise<{status: true}> {
    const auth = requireLabUser(acceptLanguage);
    const ids = [...new Set(pallet_ids.map(normalizePalletId))];
    if (!ids.length || ids.length > MAX_STRAIN_BATCH_SIZE || ids.includes("")) {
        throw APIError.invalidArgument(t("pallet_id_empty", acceptLanguage));
    }
    if (!validReportDate(measured_on) || measured_on < "0001-01-01") {
        throw APIError.invalidArgument(t("strain_date_invalid", acceptLanguage));
    }
    await using tx = await db.begin();
    const pallets = await tx.queryAll<{id: number; today: string}>`
        SELECT id, to_char(statement_timestamp() AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS today
        FROM pallets WHERE pallet_id = ANY(${ids}::text[]) AND deleted_at IS NULL
        ORDER BY id FOR UPDATE
    `;
    if (pallets.length !== ids.length) throw APIError.notFound(t("pallet_not_found", acceptLanguage));
    if (measured_on > pallets[0].today) throw APIError.invalidArgument(t("strain_date_future", acceptLanguage));
    await tx.exec`
        INSERT INTO pallet_strain_measurements (pallet_id, pallet_created_at, measured_on, recorded_by)
        SELECT id, created_at, ${measured_on}::date, ${auth.userID}
        FROM pallets WHERE id = ANY(${pallets.map(pallet => pallet.id)}::int[])
        ON CONFLICT (pallet_id, pallet_created_at, measured_on) DO NOTHING
    `;
    await tx.commit();
    return {status: true};
}

export const RecordStrainMeasurement = api(
    {method: "POST", path: "/pallets/strain/measurements/:pallet_id", expose: true, auth: true},
    async ({pallet_id, ...params}: RecordStrainParams): Promise<{status: true}> =>
        recordMeasurements({...params, pallet_ids: [pallet_id]}),
);

export const RecordStrainMeasurements = api(
    {method: "POST", path: "/pallets/strain/measurements", expose: true, auth: true},
    async (params: BatchStrainParams): Promise<{status: true}> => recordMeasurements(params),
);
