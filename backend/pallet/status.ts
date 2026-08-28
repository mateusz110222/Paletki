import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import {PalletStatus} from "../shared/types";
import {t} from "../shared/i18n";
import {encodeAuditDescription} from "./audit-description";
import {requireAuthenticatedUser, requirePalletManagementUser} from "../shared/authorization";
import {canChangePalletStatus} from "../shared/permissions";
import {
    type AuditReason,
    type PalletID,
    normalizePalletId,
    normalizePalletStatus,
} from "../shared/validation";

interface LocalizedAuthorizedRequest {
    acceptLanguage?: Header<"Accept-Language">;
}

interface ChangeStatusParams extends LocalizedAuthorizedRequest {
    pallet_id: PalletID;
    block_reason: AuditReason;
    new_status: PalletStatus;
    reset_cycles?: boolean | null;
}

interface BlockPalletParams extends LocalizedAuthorizedRequest {
    pallet_id: PalletID;
    block_reason: AuditReason;
}

interface PalletActionParams extends LocalizedAuthorizedRequest {
    pallet_id: PalletID;
}

interface ResetCyclesParams extends LocalizedAuthorizedRequest {
    pallet_id: PalletID;
    block_reason?: string | null;
}

interface ResetCyclesResponse {
    status: boolean;
    pallet_id: string;
    new_status: PalletStatus;
    current_cycles: number;
}

async function changePalletStatus(
    palletId: string,
    newStatus: PalletStatus,
    operator: string,
    blockReason: string | null,
    description: string,
    resetCycles: boolean,
    lang?: string,
    maintenanceOnly = false,
): Promise<void> {
    try {
        await using tx = await db.begin();
        const row = await tx.queryRow<{id: number; status: PalletStatus}>`
            SELECT id, status FROM pallets
            WHERE pallet_id = ${palletId} AND deleted_at IS NULL
            FOR UPDATE
        `;
        if (!row) throw APIError.notFound(t("pallet_not_found", lang));
        if (maintenanceOnly && row.status !== 'Damaged' && row.status !== 'Washing_Required') {
            throw APIError.permissionDenied(t('auth_maintenance_required', lang));
        }

        await tx.exec`
            UPDATE pallets
            SET status = ${newStatus}, block_reason = ${blockReason}, updated_by = ${operator},
                updated_at = NOW(), current_cycles = CASE WHEN ${resetCycles} THEN 0 ELSE current_cycles END,
                last_operation_description = ${description}
            WHERE pallet_id = ${palletId} AND deleted_at IS NULL
        `;
        await tx.commit();
    } catch (error) {
        if (error instanceof APIError) throw error;
        throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
    }
}

export const ChangePalletStatus = api(
    {method: "POST", path: "/pallets/change-status", expose: true, auth: true},
    async (params: ChangeStatusParams): Promise<void> => {
        const palletId = normalizePalletId(params.pallet_id);
        const requestedStatus = normalizePalletStatus(params.new_status);
        const auth = requireAuthenticatedUser();

        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", params.acceptLanguage));
        if (!requestedStatus) {
            throw APIError.invalidArgument(t("status_invalid", params.acceptLanguage, {status: params.new_status}));
        }
        if (!params.block_reason?.trim()) {
            throw APIError.invalidArgument(t("block_reason_required", params.acceptLanguage));
        }
        if (!canChangePalletStatus(auth.hasITDepartmentAccess, requestedStatus, params.reset_cycles === true, auth.hasURDepartmentAccess, auth.hasMEDepartmentAccess)) {
            throw APIError.permissionDenied(t("auth_status_forbidden", params.acceptLanguage));
        }
        await changePalletStatus(
            palletId,
            requestedStatus,
            auth.fullName,
            params.block_reason.trim(),
            encodeAuditDescription("audit_status_changed", {}, params.block_reason),
            params.reset_cycles === true,
            params.acceptLanguage,
            auth.hasURDepartmentAccess && !auth.hasITDepartmentAccess && !auth.hasMEDepartmentAccess,
        );
    },
);

export const BlockPallet = api(
    {method: "POST", path: "/pallets/block", expose: true, auth: true},
    async (params: BlockPalletParams): Promise<void> => {
        const palletId = normalizePalletId(params.pallet_id);
        const operator = requirePalletManagementUser().fullName;
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
    async (params: PalletActionParams): Promise<void> => {
        const palletId = normalizePalletId(params.pallet_id);
        const operator = requirePalletManagementUser().fullName;
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
        const palletId = normalizePalletId(params.pallet_id);
        const operator = requirePalletManagementUser().fullName;
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
