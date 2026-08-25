import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import {PALLET_STATUSES, PalletStatus} from "../shared/types";
import {t} from "./i18n";
import {encodeAuditDescription} from "./audit-description";
import {requireAuthenticatedUser, requireITDepartmentUser} from "../auth/authorization";
import {canChangePalletStatus} from "../auth/permissions";

interface LocalizedAuthorizedRequest {
    acceptLanguage?: Header<"Accept-Language">;
}

interface UpdateStatusParams extends LocalizedAuthorizedRequest {
    pallet_id: string;
    block_reason?: string | null;
    new_status?: string | null;
    reset_cycles?: boolean | null;
}

interface ResetCyclesParams extends LocalizedAuthorizedRequest {
    pallet_id: string;
    block_reason?: string | null;
}

interface ResetCyclesResponse {
    status: boolean;
    pallet_id: string;
    new_status: PalletStatus;
    current_cycles: number;
}

function isPalletStatus(status: string): status is PalletStatus {
    return PALLET_STATUSES.includes(status as PalletStatus);
}

async function changePalletStatus(
    palletId: string,
    newStatus: PalletStatus,
    operator: string,
    blockReason: string | null,
    description: string,
    resetCycles: boolean,
    lang?: string,
): Promise<void> {
    try {
        await using tx = await db.begin();
        const row = await tx.queryRow<{id: number}>`SELECT id FROM pallets WHERE pallet_id = ${palletId}`;
        if (!row) throw APIError.notFound(t("pallet_not_found", lang));

        await tx.exec`
            UPDATE pallets
            SET status = ${newStatus}, block_reason = ${blockReason}, updated_by = ${operator},
                updated_at = NOW(), current_cycles = CASE WHEN ${resetCycles} THEN 0 ELSE current_cycles END,
                last_operation_description = ${description}
            WHERE pallet_id = ${palletId}
        `;
        await tx.commit();
    } catch (error) {
        if (error instanceof APIError) throw error;
        throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
    }
}

export const ChangePalletStatus = api(
    {method: "POST", path: "/pallets/change-status", expose: true, auth: true},
    async (params: UpdateStatusParams): Promise<void> => {
        const palletId = params.pallet_id?.trim();
        const requestedStatus = params.new_status?.trim();
        const auth = requireAuthenticatedUser();

        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", params.acceptLanguage));
        if (!requestedStatus) throw APIError.invalidArgument(t("new_status_required", params.acceptLanguage));
        if (!isPalletStatus(requestedStatus)) {
            throw APIError.invalidArgument(t("status_invalid", params.acceptLanguage, {status: requestedStatus}));
        }
        if (!params.block_reason?.trim()) {
            throw APIError.invalidArgument(t("block_reason_required", params.acceptLanguage));
        }
        if (!canChangePalletStatus(auth.hasITDepartmentAccess, requestedStatus, params.reset_cycles === true)) {
            throw APIError.permissionDenied(t("auth_staff_required", params.acceptLanguage));
        }
        await changePalletStatus(
            palletId,
            requestedStatus,
            auth.fullName,
            params.block_reason.trim(),
            encodeAuditDescription("audit_status_changed", {}, params.block_reason),
            params.reset_cycles === true,
            params.acceptLanguage,
        );
    },
);

export const BlockPallet = api(
    {method: "POST", path: "/pallets/block", expose: true, auth: true},
    async (params: UpdateStatusParams): Promise<void> => {
        const palletId = params.pallet_id?.trim();
        const operator = requireITDepartmentUser().fullName;
        const reason = params.block_reason?.trim();
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", params.acceptLanguage));
        if (!reason) throw APIError.invalidArgument(t("block_reason_required", params.acceptLanguage));

        await changePalletStatus(
            palletId,
            "Blocked",
            operator,
            reason,
            encodeAuditDescription("audit_blocked", {}, reason),
            false,
            params.acceptLanguage,
        );
    },
);

export const UnblockPallet = api(
    {method: "POST", path: "/pallets/unblock", expose: true, auth: true},
    async (params: UpdateStatusParams): Promise<void> => {
        const palletId = params.pallet_id?.trim();
        const operator = requireITDepartmentUser().fullName;
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", params.acceptLanguage));

        await changePalletStatus(
            palletId,
            "Active",
            operator,
            null,
            encodeAuditDescription("audit_unblocked"),
            false,
            params.acceptLanguage,
        );
    },
);

export const ResetPalletCycles = api(
    {method: "POST", path: "/pallets/reset-cycles", expose: true, auth: true},
    async (params: ResetCyclesParams): Promise<ResetCyclesResponse> => {
        const palletId = params.pallet_id?.trim();
        const operator = requireITDepartmentUser().fullName;
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", params.acceptLanguage));

        await changePalletStatus(
            palletId,
            "Active",
            operator,
            null,
            encodeAuditDescription("audit_reset_cycles", {}, params.block_reason),
            true,
            params.acceptLanguage,
        );

        return {status: true, pallet_id: palletId, new_status: "Active", current_cycles: 0};
    },
);
