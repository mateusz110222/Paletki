import { api, APIError, Header } from "encore.dev/api";
import { db } from "./db";
import { AuditLog, Pallet, PalletStatus } from "../shared/types";
import { t } from "./i18n";

export interface GetAllPalletsResponse {
    pallets: Pallet[];
}

interface GetPalletParams {
    pallet_id: string;
    acceptLanguage?: Header<"Accept-Language">;
}

interface AddPalletParams {
    pallet_id: string;
    project: string;
    model: string;
    max_cycles: number;
    nests: number;
    status: PalletStatus | string;
    block_reason?: string | null;
    fis?: number | null;
    created_by: string;
    acceptLanguage?: Header<"Accept-Language">;
}

export interface AddPalletResponse {
    status: boolean;
    pallet_id: string;
}

interface GetPalletHistoryParams {
    pallet_id: string;
    acceptLanguage?: Header<"Accept-Language">;
}

export interface GetPalletHistoryResponse {
    history: AuditLog[];
}

export const GetAllPallets = api(
    { method: "GET", path: "/pallets", expose: true },
    async (): Promise<GetAllPalletsResponse> => {
        const pallets = await db.queryAll<Pallet>`SELECT * FROM pallets`;

        if (pallets.length === 0) {
            return { pallets: [] };
        }

        return { pallets };
    }
);

export const GetPallet = api(
    { method: "GET", path: "/pallets/:pallet_id", expose: true },
    async (params: GetPalletParams): Promise<Pallet> => {
        const lang = params.acceptLanguage;

        const pallet = await db.queryRow<Pallet>`
            SELECT * FROM pallets WHERE pallet_id = ${params.pallet_id}
        `;
        if (!pallet) throw APIError.notFound(t("pallet_not_found", lang));

        pallet.history = await db.queryAll<AuditLog>`
            SELECT * FROM pallet_audit_logs 
            WHERE pallet_id = ${pallet.pallet_id} 
            ORDER BY timestamp DESC
        `;

        return pallet;
    }
);

export const AddPallet = api(
    { method: "POST", path: "/pallets", expose: true },
    async (params: AddPalletParams): Promise<AddPalletResponse> => {
        const lang = params.acceptLanguage;

        if (!params.pallet_id?.trim()) {
            throw APIError.invalidArgument(t("pallet_id_empty", lang));
        }

        const fisValue = params.fis ?? 0;
        if (fisValue <= 0) {
            throw APIError.invalidArgument(t("fis_invalid", lang));
        }

        if (!params.created_by?.trim()) {
            throw APIError.invalidArgument(t("operator_required", lang));
        }

        const status = params.status ?? "Active";
        if (status === "Blocked" && !params.block_reason?.trim()) {
            throw APIError.invalidArgument(t("block_reason_required", lang));
        }

        if (params.max_cycles !== undefined && params.max_cycles <= 0) {
            throw APIError.invalidArgument(t("max_cycles_invalid", lang));
        }

        if (params.nests !== undefined && params.nests <= 0) {
            throw APIError.invalidArgument(t("nests_invalid", lang));
        }

        try {
                await using tx = await db.begin();

            await tx.exec`
                INSERT INTO pallets (
                    pallet_id, project, model, max_cycles, nests, status,
                    block_reason, fis, created_by, updated_by
                )
                VALUES (
                           ${params.pallet_id.trim()},
                           ${params.project?.trim() ?? null},
                           ${params.model?.trim() ?? null},
                           ${params.max_cycles ?? 200},
                           ${params.nests ?? 1},
                           ${status},
                           ${params.block_reason?.trim() ?? null},
                           ${fisValue},
                           ${params.created_by.trim()},
                           ${params.created_by.trim()}
                       )
            `;

            await tx.commit();
        } catch (err: any) {
            const isUniqueViolation =
                String(err?.message || err).includes('23505') ||
                String(err?.message || err).includes('duplicate key value');

            if (isUniqueViolation) {
                throw APIError.alreadyExists(t("pallet_exists", lang));
            }

            const errorMessage = err instanceof Error ? err.message : String(err);
            throw APIError.internal(errorMessage);
        }

        return {
            status: true,
            pallet_id: params.pallet_id,
        };
    }
);

export const GetPalletHistory = api(
    { method: "GET", path: "/pallets/:pallet_id/history", expose: true },
    async (params: GetPalletHistoryParams): Promise<GetPalletHistoryResponse> => {
        const lang = params.acceptLanguage;

        if (!params.pallet_id?.trim()) {
            throw APIError.invalidArgument(t("pallet_id_empty",lang));
        }

        const history = await db.queryAll<AuditLog>`
            SELECT * FROM pallet_audit_logs 
            WHERE pallet_id = ${params.pallet_id.trim()} 
            ORDER BY timestamp DESC
        `;

        return { history: history || [] };
    }
);