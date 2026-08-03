import { api, APIError, Header } from "encore.dev/api";
import { db } from "./db";
import { t } from "./i18n";

interface AddAuditLogParams {
    pallet_id: string;
    timestamp: string;
    operator_id: string;
    previous_status?: string;
    new_status: string;
    description: string;
    acceptLanguage?: Header<"Accept-Language">;
}

interface AddAuditLogResponse {
    status: boolean;
    pallet_id: string;
}

interface UpdateStatusParams {
    pallet_id: string;
    operator_id: string;
    block_reason?: string | null;
    new_status?: string | null;
    reset_cycles?: boolean | null;
    acceptLanguage?: Header<"Accept-Language">;
}

interface ResetCyclesParams {
    pallet_id: string;
    operator_id: string;
    acceptLanguage?: Header<"Accept-Language">;
}

interface ResetCyclesResponse {
    status: boolean;
    pallet_id: string;
    new_status: string;
    current_cycles: number;
}

async function changePalletStatus(
    palletId: string,
    newStatus: string,
    operatorId: string,
    blockReason: string | null,
    resetCycles?: boolean,
    lang?: string
): Promise<void> {
    await using tx = await db.begin();

    try {
        const row = await tx.queryRow`SELECT id
                                      FROM pallets
                                      WHERE pallet_id = ${palletId}`;
        if (!row) {
            throw APIError.notFound(t("pallet_not_found", lang));
        }

        await tx.exec`
            UPDATE pallets
            SET status         = ${newStatus},
                block_reason   = ${blockReason},
                updated_by     = ${operatorId},
                current_cycles = CASE WHEN ${!!resetCycles} THEN 0 ELSE current_cycles END
            WHERE pallet_id    = ${palletId}
        `;
        await tx.commit();

    } catch (err: any) {
        if (err instanceof APIError) throw err;
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw APIError.internal(errorMessage);
    }
}


export const ChangePalletStatus = api(
    { method: "POST", path: "/pallets/change-status", expose: true },
    async (params: UpdateStatusParams): Promise<void> => {
        const lang = params.acceptLanguage;
        if (!params.pallet_id?.trim()) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!params.operator_id?.trim()) throw APIError.invalidArgument(t("operator_required", lang));
        if (!params.new_status?.trim()) throw APIError.invalidArgument(t("new_status_required", lang));
        if (!params.block_reason?.trim()) throw APIError.invalidArgument(t("block_reason_required", lang));

        await changePalletStatus(params.pallet_id.trim(), params.new_status.trim(), params.operator_id.trim(), params.block_reason?.trim() || null, params.reset_cycles ?? false, lang);
    }
);

export const BlockPallet = api(
    { method: "POST", path: "/pallets/block", expose: true },
    async (params: UpdateStatusParams): Promise<void> => {
        const lang = params.acceptLanguage;
        if (!params.pallet_id?.trim()) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!params.operator_id?.trim()) throw APIError.invalidArgument(t("operator_required", lang));
        if (!params.block_reason?.trim()) throw APIError.invalidArgument(t("block_reason_required", lang));

        await changePalletStatus(params.pallet_id.trim(), "Blocked", params.operator_id.trim(), params.block_reason.trim(), false, lang);
    }
);

export const UnblockPallet = api(
    { method: "POST", path: "/pallets/unblock", expose: true },
    async (params: UpdateStatusParams): Promise<void> => {
        const lang = params.acceptLanguage;
        if (!params.pallet_id?.trim()) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!params.operator_id?.trim()) throw APIError.invalidArgument(t("operator_required", lang));

        await changePalletStatus(params.pallet_id.trim(), "Active", params.operator_id.trim(), null, false, lang);
    }
);

export const AddAuditLog = api(
    { method: "POST", path: "/AddAuditLog", expose: true },
    async (params: AddAuditLogParams): Promise<AddAuditLogResponse> => {
        const lang = params.acceptLanguage;

        if (!params.pallet_id?.trim()) {
            throw APIError.invalidArgument(t("pallet_id_empty", lang));
        }
        if (!params.operator_id?.trim()) {
            throw APIError.invalidArgument(t("operator_required", lang));
        }
        if (!params.new_status?.trim()) {
            throw APIError.invalidArgument(t("new_status_required", lang));
        }
        if (!params.description?.trim()) {
            throw APIError.invalidArgument(t("description_required", lang));
        }

        let computedPreviousStatus = params.previous_status;
        if (!computedPreviousStatus || computedPreviousStatus.trim() === "") {
            const row = await db.queryRow`
                SELECT status
                FROM pallets
                WHERE pallet_id = ${params.pallet_id}
            `;
            if (!row) {
                throw APIError.notFound(t("pallet_not_found", lang));
            }
            computedPreviousStatus = row.status;
        }

        try {
            await using tx = await db.begin();
            await tx.exec`
                INSERT INTO pallet_audit_logs (pallet_id, timestamp, operator_id, previous_status, new_status,
                                               description)
                VALUES (${params.pallet_id}, ${params.timestamp}, ${params.operator_id}, ${computedPreviousStatus},
                        ${params.new_status}, ${params.description})
            `;
            await tx.commit();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            throw APIError.internal(`${t("audit_log_write_error", lang)}: ${errorMessage}`);
        }

        return { status: true, pallet_id: params.pallet_id };
    }
);

export const ResetPalletCycles = api(
    { method: "POST", path: "/pallets/reset-cycles", expose: true },
    async (params: ResetCyclesParams): Promise<ResetCyclesResponse> => {
        const lang = params.acceptLanguage;

        if (!params.pallet_id?.trim()) {
            throw APIError.invalidArgument(t("pallet_id_empty", lang));
        }
        if (!params.operator_id?.trim()) {
            throw APIError.invalidArgument(t("operator_required", lang));
        }

        try {
            await using tx = await db.begin();

            const currentPallet = await tx.queryRow`
                SELECT status
                FROM pallets
                WHERE pallet_id = ${params.pallet_id}
            `;

            if (!currentPallet) {
                throw APIError.notFound(t("pallet_not_found", lang));
            }

            const previousStatus = currentPallet.status;

            await tx.exec`
                UPDATE pallets
                SET current_cycles     = 0,
                    current_unit_cycle = 0,
                    status             = 'Active',
                    block_reason       = NULL,
                    updated_at         = NOW(),
                    updated_by = ${params.operator_id}
                WHERE pallet_id = ${params.pallet_id}
            `;

            const description = t("audit_reset_cycles", lang);

            await tx.exec`
                INSERT INTO pallet_audit_logs (pallet_id, timestamp, operator_id, previous_status, new_status,
                                               description)
                VALUES (${params.pallet_id}, NOW(), ${params.operator_id}, ${previousStatus}, 'Active', ${description})
            `;

            await tx.commit();

            return {
                status: true,
                pallet_id: params.pallet_id,
                new_status: "Active",
                current_cycles: 0
            };

        } catch (err) {
            if (err instanceof APIError) throw err;

            const errorMessage = err instanceof Error ? err.message : String(err);
            throw APIError.internal(`${t("reset_cycles_error", lang)}: ${errorMessage}`);
        }
    }
);