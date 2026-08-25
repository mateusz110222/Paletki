import {api, APIError} from "encore.dev/api";
import {SQLDatabase} from "encore.dev/storage/sqldb";
import {PalletStatus} from "../shared/types";
import {requireAuthenticatedUser} from "../auth/authorization";

const db = SQLDatabase.named("pallets");

interface PalletPathParams {
    pallet_id: string;
}

type RegisterCycleParams = PalletPathParams;

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
    fis: number;
}

export interface RegisterCycleResponse {
    status: true;
    pallet_id: string;
    current_cycles: number;
    total_cycles: number;
    pallet_status: PalletStatus;
}

interface PalletAvailability {
    status: PalletStatus;
    current_cycles: number;
    max_cycles: number;
}

function normalizePalletId(value: string): string {
    const palletId = value?.trim().toUpperCase();
    if (!palletId) throw APIError.invalidArgument("Pallet ID is required.");
    return palletId;
}

/**
 * Fast, read-only view used by the legacy soldering UI.
 * It replaces direct reads from the old `soldering.fixtures` table.
 */
export const GetSolderingPallet = api(
    {method: "GET", path: "/fis/soldering/pallets/:pallet_id", expose: true},
    async (params: PalletPathParams): Promise<SolderingPallet> => {
        const palletId = normalizePalletId(params.pallet_id);

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
                WHERE pallet_id = ${palletId}
            `;

            if (!pallet) throw APIError.notFound(`Pallet ${palletId} was not found.`);
            return pallet;
        } catch (error) {
            if (error instanceof APIError) throw error;
            throw APIError.internal("Could not read pallet data.", error instanceof Error ? error : undefined);
        }
    },
);

/**
 * Atomically records a completed soldering cycle.
 * Both counters are incremented in one statement, so concurrent stations cannot
 * overwrite one another. The existing database trigger changes the pallet to
 * Washing_Required when the configured limit is reached.
 */
export const RegisterSolderingCycle = api(
    {method: "POST", path: "/fis/soldering/pallets/:pallet_id/cycles", expose: true, auth: true},
    async (params: RegisterCycleParams): Promise<RegisterCycleResponse> => {
        const palletId = normalizePalletId(params.pallet_id);
        const operatorId = requireAuthenticatedUser().fullName;

        try {
            const updated = await db.queryRow<{
                current_cycles: number;
                total_cycles: number;
                status: PalletStatus;
            }>`
                UPDATE pallets
                SET current_cycles = current_cycles + 1,
                    total_cycles = total_cycles + 1,
                    updated_at = NOW(),
                    updated_by = ${operatorId}
                WHERE pallet_id = ${palletId}
                  AND status = 'Active'
                  AND current_cycles < max_cycles
                RETURNING current_cycles, total_cycles, status
            `;

            if (updated) {
                return {
                    status: true,
                    pallet_id: palletId,
                    current_cycles: updated.current_cycles,
                    total_cycles: updated.total_cycles,
                    pallet_status: updated.status,
                };
            }

            const pallet = await db.queryRow<PalletAvailability>`
                SELECT status, current_cycles, max_cycles
                FROM pallets
                WHERE pallet_id = ${palletId}
            `;

            if (!pallet) throw APIError.notFound(`Pallet ${palletId} was not found.`);
            if (pallet.status !== "Active") {
                throw APIError.failedPrecondition(`Pallet ${palletId} is not active (${pallet.status}).`);
            }
            throw APIError.failedPrecondition(`Pallet ${palletId} reached its cycle limit (${pallet.max_cycles}).`);
        } catch (error) {
            if (error instanceof APIError) throw error;
            throw APIError.internal("Could not register the soldering cycle.", error instanceof Error ? error : undefined);
        }
    },
);
