import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import {t} from "./i18n";

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
    block_reason?: string | null;
    acceptLanguage?: Header<"Accept-Language">;
}

interface ResetCyclesResponse {
    status: boolean;
    pallet_id: string;
    new_status: string;
    current_cycles: number;
}

function buildDescription(key: string, comment: string | null | undefined, lang?: string): string {
    const base = t(key, lang);
    const c = comment?.trim();
    return c ? `${base}: ${c}` : base;
}

async function changePalletStatus(
    palletId: string,
    newStatus: string,
    operatorId: string,
    blockReason: string | null,
    description: string,
    resetCycles = false,
    lang?: string
): Promise<void> {
        await using tx = await db.begin();

    const row = await tx.queryRow`SELECT id
                                  FROM pallets
                                  WHERE pallet_id = ${palletId}`;
    if (!row) throw APIError.notFound(t("pallet_not_found", lang));

    await tx.exec`
        UPDATE pallets
        SET status                     = ${newStatus},
            block_reason               = ${blockReason},
            updated_by                 = ${operatorId},
            updated_at                 = NOW(),
            current_cycles             = CASE WHEN ${resetCycles} THEN 0 ELSE current_cycles END,
            last_operation_description = ${description}
        WHERE pallet_id = ${palletId}
    `;

    await tx.commit();
}

export const ChangePalletStatus = api(
    {method: "POST", path: "/pallets/change-status", expose: true},
    async (params: UpdateStatusParams): Promise<void> => {
        const lang = params.acceptLanguage;
        if (!params.pallet_id?.trim()) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!params.operator_id?.trim()) throw APIError.invalidArgument(t("operator_required", lang));
        if (!params.new_status?.trim()) throw APIError.invalidArgument(t("new_status_required", lang));
        if (!params.block_reason?.trim()) throw APIError.invalidArgument(t("block_reason_required", lang));

        await changePalletStatus(
            params.pallet_id.trim(),
            params.new_status.trim(),
            params.operator_id.trim(),
            params.block_reason.trim(),
            buildDescription("audit_status_changed", params.block_reason, lang),
            params.reset_cycles ?? false,
            lang
        );
    }
);

export const BlockPallet = api(
    {method: "POST", path: "/pallets/block", expose: true},
    async (params: UpdateStatusParams): Promise<void> => {
        const lang = params.acceptLanguage;
        if (!params.pallet_id?.trim()) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!params.operator_id?.trim()) throw APIError.invalidArgument(t("operator_required", lang));
        if (!params.block_reason?.trim()) throw APIError.invalidArgument(t("block_reason_required", lang));

        await changePalletStatus(
            params.pallet_id.trim(),
            "Blocked",
            params.operator_id.trim(),
            params.block_reason.trim(),
            buildDescription("audit_blocked", params.block_reason, lang),
            false,
            lang
        );
    }
);

export const UnblockPallet = api(
    {method: "POST", path: "/pallets/unblock", expose: true},
    async (params: UpdateStatusParams): Promise<void> => {
        const lang = params.acceptLanguage;
        if (!params.pallet_id?.trim()) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!params.operator_id?.trim()) throw APIError.invalidArgument(t("operator_required", lang));

        await changePalletStatus(
            params.pallet_id.trim(),
            "Active",
            params.operator_id.trim(),
            null,
            buildDescription("audit_unblocked", params.block_reason, lang),
            false,
            lang
        );
    }
);

export const ResetPalletCycles = api(
    {method: "POST", path: "/pallets/reset-cycles", expose: true},
    async (params: ResetCyclesParams): Promise<ResetCyclesResponse> => {
        const lang = params.acceptLanguage;

        if (!params.pallet_id?.trim()) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!params.operator_id?.trim()) throw APIError.invalidArgument(t("operator_required", lang));

        try {
                await using tx = await db.begin();

            const currentPallet = await tx.queryRow`
                SELECT status
                FROM pallets
                WHERE pallet_id = ${params.pallet_id.trim()}
            `;

            if (!currentPallet) throw APIError.notFound(t("pallet_not_found", lang));

            const description = buildDescription("audit_reset_cycles", params.block_reason, lang);

            await tx.exec`
                UPDATE pallets
                SET current_cycles             = 0,
                    current_unit_cycle         = 0,
                    status                     = 'Active',
                    block_reason               = NULL,
                    updated_at                 = NOW(),
                    updated_by                 = ${params.operator_id.trim()},
                    last_operation_description = ${description}
                WHERE pallet_id = ${params.pallet_id.trim()}
            `;

            await tx.commit();

            return {
                status: true,
                pallet_id: params.pallet_id.trim(),
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