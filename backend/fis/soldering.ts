import {api, APIError} from "encore.dev/api";
import {PalletStatus} from "../shared/types";
import {normalizePalletId, normalizeStation} from "../shared/validation";
import {palletsDatabase as db} from "../shared/persistence";

interface PalletPathParams {
    pallet_id: string;
}

interface RegisterCycleParams extends PalletPathParams {
    event_id: string;
    station: string;
    process: string;
    unit_ids: string[];
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
}

export interface RegisterCycleResponse {
    status: true;
    event_id: string;
    cycle_recorded: boolean;
    pallet_id: string;
    current_cycles: number;
    total_cycles: number;
    pallet_status: PalletStatus;
}

interface PalletCycleState {
    status: PalletStatus;
    current_cycles: number;
    total_cycles: number;
    max_cycles: number;
}

interface CycleEventRecord {
    pallet_id: string;
    station: string;
    process: string;
    unit_ids_match: boolean;
    state: "claimed" | "recorded";
    result_current_cycles: number | null;
    result_total_cycles: number | null;
    result_pallet_status: PalletStatus | null;
}

const PALLET_ID_PATTERN = /^[A-Z0-9._-]{1,50}$/;
const CYCLE_EVENT_ID_PATTERN = /^[a-f0-9]{64}$/;
const STATION_PATTERN = /^[A-Z0-9._-]{1,64}$/;
const UNIT_ID_PATTERN = /^[A-Z0-9._-]{1,128}$/;

function normalizeSolderingPalletId(value: string): string {
    const palletId = normalizePalletId(String(value || ""));
    if (!PALLET_ID_PATTERN.test(palletId)) {
        throw APIError.invalidArgument("Pallet ID must contain 1-50 letters, digits, dots, hyphens, or underscores.")
            .withDetails({reason: "INVALID_PALLET_ID"});
    }
    return palletId;
}

function normalizeCycleMetadata(params: RegisterCycleParams): {
    eventId: string;
    station: string;
    processName: string;
    unitIds: string[];
} {
    const eventId = String(params.event_id || "").trim().toLowerCase();
    const station = normalizeStation(String(params.station || ""));
    const processName = String(params.process || "").trim().toUpperCase();
    const unitIds = Array.isArray(params.unit_ids)
        ? params.unit_ids.map((value) => String(value).trim().toUpperCase())
        : [];

    if (!CYCLE_EVENT_ID_PATTERN.test(eventId)) {
        throw APIError.invalidArgument("Cycle event ID must be a 64-character hexadecimal value.")
            .withDetails({reason: "INVALID_CYCLE_EVENT_ID"});
    }
    if (!STATION_PATTERN.test(station) || station === "ALL") {
        throw APIError.invalidArgument("Station must contain 1-64 letters, digits, dots, hyphens, or underscores.")
            .withDetails({reason: "INVALID_STATION"});
    }
    const processIsPrintable = [...processName].every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint > 31 && codePoint !== 127;
    });
    if (!processName || processName.length > 100 || !processIsPrintable) {
        throw APIError.invalidArgument("Process must contain 1-100 printable characters.")
            .withDetails({reason: "INVALID_PROCESS"});
    }
    if (
        unitIds.length === 0
        || unitIds.length > 10_000
        || unitIds.some((value) => !UNIT_ID_PATTERN.test(value))
        || new Set(unitIds).size !== unitIds.length
    ) {
        throw APIError.invalidArgument("Provide between 1 and 10000 unique, valid unit IDs.")
            .withDetails({reason: "INVALID_UNIT_IDS"});
    }
    return {eventId, station, processName, unitIds: unitIds.sort()};
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
    project: string;
    model: string;
    status: PalletStatus;
}

export const GetSolderingPallet = api(
    {method: "GET", path: "/fis/soldering/pallets/:pallet_id", expose: true},
    async (params: PalletPathParams): Promise<SolderingPallet> => {
        const palletId = normalizeSolderingPalletId(params.pallet_id);

        try {
            const pallet = await db.queryRow<SolderingPallet>`
                SELECT pallet_id,
                       max_cycles,
                       current_cycles,
                       total_cycles,
                       nests,
                       status,
                       block_reason,
                       COALESCE(project, '') AS project,
                       COALESCE(model, '') AS model,
                       fis
                FROM pallets
                WHERE pallet_id = ${palletId} AND deleted_at IS NULL
            `;

            if (!pallet) {
                throw APIError.notFound(`Pallet ${palletId} was not found.`)
                    .withDetails({reason: "PALLET_NOT_FOUND", pallet_id: palletId});
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
            const pallet = await tx.queryRow<StationPalletSource>`
                SELECT project, model, status
                FROM pallets
                WHERE pallet_id = ${palletId} AND deleted_at IS NULL
                FOR UPDATE
            `;
            if (!pallet) {
                throw APIError.notFound(`Pallet ${palletId} was not found.`)
                    .withDetails({reason: "PALLET_NOT_FOUND", pallet_id: palletId});
            }
            if (pallet.status !== "Active") {
                throw APIError.failedPrecondition(`Pallet ${palletId} is not active (${pallet.status}).`)
                    .withDetails({reason: "PALLET_NOT_ACTIVE", pallet_id: palletId, pallet_status: pallet.status});
            }
            const updated = await tx.queryRow<StationPalletRecord>`
                INSERT INTO production_stations (station, pallet_id, updated_at)
                VALUES (${station}, ${palletId}, NOW())
                ON CONFLICT (station) DO UPDATE
                SET pallet_id = EXCLUDED.pallet_id, updated_at = EXCLUDED.updated_at
                RETURNING station, pallet_id, updated_at
            `;
            if (!updated) throw new Error("Station assignment did not return a row.");
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
        const {eventId, station, processName, unitIds} = normalizeCycleMetadata(params);

        try {
            await using tx = await db.begin();
            const inserted = await tx.queryRow<{event_id: string}>`
                INSERT INTO soldering_cycle_events (event_id, pallet_id, station, process, unit_ids)
                VALUES (${eventId}, ${palletId}, ${station}, ${processName}, to_jsonb(${unitIds}::text[]))
                ON CONFLICT (event_id) DO NOTHING
                RETURNING event_id
            `;

            if (!inserted) {
                const original = await tx.queryRow<CycleEventRecord>`
                    SELECT pallet_id,
                           station,
                           process,
                           unit_ids = to_jsonb(${unitIds}::text[]) AS unit_ids_match,
                           state,
                           result_current_cycles,
                           result_total_cycles,
                           result_pallet_status
                    FROM soldering_cycle_events
                    WHERE event_id = ${eventId}
                `;
                if (
                    !original
                    || original.pallet_id !== palletId
                    || original.station !== station
                    || original.process !== processName
                    || !original.unit_ids_match
                ) {
                    throw APIError.alreadyExists("Cycle event ID was already used with different metadata.")
                        .withDetails({reason: "CYCLE_EVENT_METADATA_CONFLICT", event_id: eventId});
                }
                const currentCycles = original.result_current_cycles;
                const totalCycles = original.result_total_cycles;
                const palletStatus = original.result_pallet_status;
                if (original.state !== "recorded" || currentCycles === null || totalCycles === null || palletStatus === null) {
                    throw APIError.aborted("Cycle event is not finalized yet.")
                        .withDetails({reason: "CYCLE_EVENT_NOT_FINALIZED", event_id: eventId});
                }
                await tx.commit();
                return {
                    status: true,
                    event_id: eventId,
                    cycle_recorded: false,
                    pallet_id: palletId,
                    current_cycles: currentCycles,
                    total_cycles: totalCycles,
                    pallet_status: palletStatus,
                };
            }

            const pallet = await tx.queryRow<PalletCycleState>`
                SELECT status, current_cycles, total_cycles, max_cycles
                FROM pallets
                WHERE pallet_id = ${palletId} AND deleted_at IS NULL
                FOR UPDATE
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
                INSERT INTO production_stations (station, pallet_id, updated_at)
                VALUES (${station}, ${palletId}, NOW())
                ON CONFLICT (station) DO UPDATE
                SET pallet_id = EXCLUDED.pallet_id, updated_at = EXCLUDED.updated_at
            `;

            await tx.exec`
                UPDATE soldering_cycle_events
                SET state = 'recorded',
                    result_current_cycles = ${updated.current_cycles},
                    result_total_cycles = ${updated.total_cycles},
                    result_pallet_status = ${updated.status},
                    finalized_at = NOW()
                WHERE event_id = ${eventId} AND state = 'claimed'
            `;

            await tx.commit();
            return {
                status: true,
                event_id: eventId,
                cycle_recorded: true,
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
