import {api, APIError} from "encore.dev/api";
import {config} from "../config";
import {PalletStatus} from "../shared/types";
import {normalizePalletId, normalizeStation} from "../shared/validation";
import {palletsDatabase as db} from "../shared/persistence";
import type {StrainStatus} from "../pallet/strain";

interface PalletPathParams {
    pallet_id: string;
}

interface RegisterCycleParams extends PalletPathParams {
    station: string;
}

export interface SolderingPallet {
    pallet_id: string;
    max_cycles: number;
    current_cycles: number;
    total_cycles: number;
    nests: number;
    status: PalletStatus;
    block_reason: string | null;
    project: string;
    model: string;
    fis: 1 | 2;
    strain_status: StrainStatus;
}

export interface RegisterCycleResponse {
    status: true;
    pallet_id: string;
    current_cycles: number;
    total_cycles: number;
    pallet_status: PalletStatus;
}

interface PalletCycleState {
    id: number;
    status: PalletStatus;
    current_cycles: number;
    total_cycles: number;
    max_cycles: number;
    project: string;
}

const PALLET_ID_PATTERN = /^[A-Z0-9._-]{1,50}$/;
const STATION_PATTERN = /^[A-Z0-9._-]{1,64}$/;
const STATION_PROJECT_HISTORY_LIMIT = 3;

function normalizeSolderingPalletId(value: string): string {
    const palletId = normalizePalletId(String(value || ""));
    if (!PALLET_ID_PATTERN.test(palletId)) {
        throw APIError.invalidArgument("Pallet ID must contain 1-50 letters, digits, dots, hyphens, or underscores.")
            .withDetails({reason: "INVALID_PALLET_ID"});
    }
    return palletId;
}

interface SetStationPalletParams {
    station: string;
    pallet_id: string;
}

export interface SetStationPalletResponse {
    status: true;
    station: string;
    pallet_id: string;
    project: string;
    model: string;
    updated_at: string;
}

interface StationPalletRecord {
    station: string;
    pallet_id: string;
    updated_at: Date;
}

interface StationPalletSource {
    id: number;
    project: string;
    model: string;
    status: PalletStatus;
}

function requireCurrentStrain(palletId: string, strainStatus: string | undefined): void {
    if (strainStatus === "current" || strainStatus === "due_soon") return;
    const expired = strainStatus === "expired";
    throw APIError.failedPrecondition(expired ? "The strain measurement has expired." : "The pallet has no recorded strain measurement.")
        .withDetails({reason: expired ? "STRAIN_EXPIRED" : "STRAIN_MISSING", pallet_id: palletId});
}

export const GetSolderingPallet = api(
    {method: "GET", path: "/fis/soldering/pallets/:pallet_id", expose: true},
    async (params: PalletPathParams): Promise<SolderingPallet> => {
        const palletId = normalizeSolderingPalletId(params.pallet_id);

        try {
            const pallet = await db.queryRow<SolderingPallet>`
                SELECT p.pallet_id,
                       max_cycles,
                       current_cycles,
                       total_cycles,
                       nests,
                       status,
                       block_reason,
                       COALESCE(p.project, '') AS project,
                       COALESCE(p.model, '') AS model,
                       fis,
                       strain.strain_status
                FROM pallet_details p
                JOIN pallet_strain_status strain ON strain.id = p.id
                WHERE p.pallet_id = ${palletId} AND p.deleted_at IS NULL
            `;

            if (!pallet) {
                throw APIError.notFound(`Pallet ${palletId} was not found.`)
                    .withDetails({reason: "PALLET_NOT_FOUND", pallet_id: palletId});
            }
            if (config.fis.strainBlocking) {
                requireCurrentStrain(palletId, pallet.strain_status);
            }
            return pallet;
        } catch (error) {
            if (error instanceof APIError) throw error;
            throw APIError.internal("Could not read pallet data.", error instanceof Error ? error : undefined);
        }
    },
);

/** Records which pallet is currently being produced on a soldering station. */
export const SetSolderingStationPallet = api(
    {method: "PUT", path: "/fis/soldering/stations/:station/current-pallet", expose: true},
    async (params: SetStationPalletParams): Promise<SetStationPalletResponse> => {
        const station = normalizeStation(params.station);
        const palletId = normalizeSolderingPalletId(params.pallet_id);
        if (!STATION_PATTERN.test(station) || station === "ALL") {
            throw APIError.invalidArgument("Station must contain 1-64 letters, digits, dots, hyphens, or underscores, and must not be ALL.")
                .withDetails({reason: "INVALID_STATION"});
        }

        try {
            await using tx = await db.begin();
            await tx.exec`SELECT pg_advisory_xact_lock(hashtext(${station}))`;
            const pallet = await tx.queryRow<StationPalletSource>`
                SELECT a.id, p.name AS project, m.name AS model, a.status
                FROM pallets a JOIN projects p ON p.id = a.project_id
                JOIN pallet_models m ON m.id = a.model_id AND m.project_id = a.project_id
                WHERE a.pallet_id = ${palletId} AND a.deleted_at IS NULL
                FOR UPDATE OF a
            `;
            if (!pallet) {
                throw APIError.notFound(`Pallet ${palletId} was not found.`)
                    .withDetails({reason: "PALLET_NOT_FOUND", pallet_id: palletId});
            }
            if (pallet.status !== "Active") {
                throw APIError.failedPrecondition(`Pallet ${palletId} is not active (${pallet.status}).`)
                    .withDetails({reason: "PALLET_NOT_ACTIVE", pallet_id: palletId, pallet_status: pallet.status});
            }
            if (config.fis.strainBlocking) {
                const strain = await tx.queryRow<{strain_status: string}>`SELECT strain_status FROM pallet_strain_status WHERE id = ${pallet.id}`;
                requireCurrentStrain(palletId, strain?.strain_status);
            }
            await tx.exec`
                DELETE FROM production_stations existing
                USING pallet_details existing_pallet
                WHERE existing.station = ${station}
                  AND existing.pallet_id = existing_pallet.pallet_id
                  AND existing_pallet.project = ${pallet.project}
                  AND existing.pallet_id <> ${palletId}
            `;
            const updated = await tx.queryRow<StationPalletRecord>`
                INSERT INTO production_stations (station, pallet_id, updated_at)
                VALUES (${station}, ${palletId}, NOW())
                ON CONFLICT (station, pallet_id) DO UPDATE
                SET updated_at = EXCLUDED.updated_at
                RETURNING station, pallet_id, updated_at
            `;
            if (!updated) throw new Error("Station assignment did not return a row.");
            await tx.exec`
                DELETE FROM production_stations old_assignment
                WHERE old_assignment.station = ${station}
                  AND old_assignment.pallet_id IN (
                    SELECT pallet_id
                    FROM production_stations
                    WHERE station = ${station}
                    ORDER BY updated_at DESC, pallet_id DESC
                    OFFSET ${STATION_PROJECT_HISTORY_LIMIT}
                  )
            `;
            await tx.commit();
            return {
                ...updated,
                project: pallet.project,
                model: pallet.model,
                status: true,
                updated_at: updated.updated_at.toISOString(),
            };
        } catch (error) {
            if (error instanceof APIError) throw error;
            throw APIError.internal("Could not update the soldering station.", error instanceof Error ? error : undefined);
        }
    },
);

/**
 * Atomically records a completed soldering cycle.
 * Both counters are incremented in one statement, so concurrent stations cannot
 * overwrite one another. The existing database trigger changes the pallet to
 * Washing_Required when the configured limit is reached.
 * This legacy FIS integration does not use a user session. Its deployment must
 * restrict network access to trusted stations; that boundary is not enforced here.
 * The source label below is not an authenticated identity.
 */
export const RegisterSolderingCycle = api(
    {method: "POST", path: "/fis/soldering/pallets/:pallet_id/cycles", expose: true},
    async (params: RegisterCycleParams): Promise<RegisterCycleResponse> => {
        const palletId = normalizeSolderingPalletId(params.pallet_id);
        const station = normalizeStation(String(params.station || ""));
        if (!STATION_PATTERN.test(station) || station === "ALL") {
            throw APIError.invalidArgument("Invalid station.").withDetails({reason: "INVALID_STATION"});
        }

        try {
            await using tx = await db.begin();
            await tx.exec`SELECT pg_advisory_xact_lock(hashtext(${station}))`;
            const pallet = await tx.queryRow<PalletCycleState>`
                SELECT a.id, a.status, a.current_cycles, a.total_cycles, a.max_cycles, p.name AS project
                FROM pallets a JOIN projects p ON p.id = a.project_id
                WHERE a.pallet_id = ${palletId} AND a.deleted_at IS NULL
                FOR UPDATE OF a
            `;
            if (!pallet) {
                throw APIError.notFound(`Pallet ${palletId} was not found.`)
                    .withDetails({reason: "PALLET_NOT_FOUND", pallet_id: palletId});
            }
            if (pallet.status !== "Active") {
                throw APIError.failedPrecondition(`Pallet ${palletId} is not active (${pallet.status}).`)
                    .withDetails({reason: "PALLET_NOT_ACTIVE", pallet_id: palletId, pallet_status: pallet.status});
            }
            if (pallet.current_cycles >= pallet.max_cycles) {
                throw APIError.failedPrecondition(`Pallet ${palletId} reached its cycle limit (${pallet.max_cycles}).`)
                    .withDetails({reason: "CYCLE_LIMIT_REACHED", pallet_id: palletId, max_cycles: pallet.max_cycles});
            }
            if (config.fis.strainBlocking) {
                const strain = await tx.queryRow<{strain_status: string}>`SELECT strain_status FROM pallet_strain_status WHERE id = ${pallet.id}`;
                requireCurrentStrain(palletId, strain?.strain_status);
            }

            const updated = await tx.queryRow<Omit<PalletCycleState, "max_cycles">>`
                UPDATE pallets
                SET current_cycles = current_cycles + 1,
                    total_cycles = total_cycles + 1,
                    updated_at = NOW(),
                    updated_by = 'FIS'
                WHERE pallet_id = ${palletId}
                RETURNING current_cycles, total_cycles, status
            `;
            if (!updated) throw new Error("Pallet cycle update did not return a row.");

            await tx.exec`
                DELETE FROM production_stations existing
                USING pallet_details existing_pallet
                WHERE existing.station = ${station}
                  AND existing.pallet_id = existing_pallet.pallet_id
                  AND existing_pallet.project = ${pallet.project}
                  AND existing.pallet_id <> ${palletId}
            `;
            await tx.exec`
                INSERT INTO production_stations (station, pallet_id, updated_at)
                VALUES (${station}, ${palletId}, NOW())
                ON CONFLICT (station, pallet_id) DO UPDATE
                SET updated_at = EXCLUDED.updated_at
            `;
            await tx.exec`
                DELETE FROM production_stations old_assignment
                WHERE old_assignment.station = ${station}
                  AND old_assignment.pallet_id IN (
                    SELECT pallet_id
                    FROM production_stations
                    WHERE station = ${station}
                    ORDER BY updated_at DESC, pallet_id DESC
                    OFFSET ${STATION_PROJECT_HISTORY_LIMIT}
                  )
            `;

            await tx.commit();
            return {
                status: true,
                pallet_id: palletId,
                current_cycles: updated.current_cycles,
                total_cycles: updated.total_cycles,
                pallet_status: updated.status,
            };
        } catch (error) {
            if (error instanceof APIError) throw error;
            throw APIError.internal("Could not register the soldering cycle.", error instanceof Error ? error : undefined);
        }
    },
);
