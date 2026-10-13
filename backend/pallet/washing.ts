import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import {requireMaintenanceUser} from "../shared/authorization";
import {t} from "../shared/i18n";
import {type PalletID, normalizePalletId} from "../shared/validation";
import type {Pallet, PalletStatus} from "../shared/types";
import {type PalletRecord, toPalletDTO} from "./models";
import {encodeAuditDescription} from "./audit-description";

interface ConfirmWashingParams {
    pallet_id: PalletID;
    expected_cycles: number;
    expected_updated_at: string;
    comment?: string;
    acceptLanguage?: Header<"Accept-Language">;
}
interface ConfirmWashingResponse { pallet: Pallet; reset: boolean; }

export const ConfirmPalletWashing = api(
    {method: "POST", path: "/pallets/confirm-washing", expose: true, auth: true},
    async (params: ConfirmWashingParams): Promise<ConfirmWashingResponse> => {
        const auth = requireMaintenanceUser();
        const id = normalizePalletId(params.pallet_id);
        const comment = params.comment?.trim() ?? "";
        if (!id || !Number.isSafeInteger(params.expected_cycles) || params.expected_cycles < 0 || !Number.isFinite(Date.parse(params.expected_updated_at)) || comment.length > 1000) {
            throw APIError.invalidArgument(t("washing_invalid", params.acceptLanguage));
        }
        await using tx = await db.begin();
        const before = await tx.queryRow<{status: PalletStatus; current_cycles: number; updated_at: Date}>`
            SELECT status, current_cycles, updated_at FROM pallets WHERE pallet_id = ${id} AND deleted_at IS NULL FOR UPDATE`;
        if (!before) throw APIError.notFound(t("pallet_not_found", params.acceptLanguage));
        if (before.status !== "Active" && before.status !== "Washing_Required") {
            throw APIError.failedPrecondition(t("washing_status_forbidden", params.acceptLanguage));
        }
        if (before.current_cycles !== params.expected_cycles || before.updated_at.toISOString() !== new Date(params.expected_updated_at).toISOString()) {
            throw APIError.aborted(t("washing_conflict", params.acceptLanguage));
        }
        const reset = before.status !== "Active" || before.current_cycles !== 0;
        if (reset) {
            const description = encodeAuditDescription("audit_washing_confirmed", {cycles: before.current_cycles}, comment);
            // Counter-only production updates are intentionally not audited by the trigger.
            // This manual confirmation gets exactly one event, including early washing.
            await tx.exec`SELECT set_config('palletx.report_edit', 'on', true)`;
            await tx.exec`UPDATE pallets SET current_cycles = 0, status = 'Active', block_reason = NULL,
                updated_by = ${auth.fullName}, updated_at = NOW(), last_operation_description = ${description}
                WHERE pallet_id = ${id}`;
            await tx.exec`INSERT INTO pallet_audit_logs (pallet_id, operator_id, previous_status, new_status, description)
                VALUES (${id}, ${auth.fullName}, ${before.status}, 'Active', ${description})`;
        }
        const row = await tx.queryRow<PalletRecord>`SELECT * FROM pallet_details WHERE pallet_id = ${id}`;
        await tx.commit();
        return {pallet: toPalletDTO(row!, params.acceptLanguage), reset};
    },
);
