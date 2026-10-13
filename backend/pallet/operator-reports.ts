import {api, APIError, Header, Query} from "encore.dev/api";
import {db} from "./db";
import {requireAuthenticatedUser, requireMaintenanceUser} from "../shared/authorization";
import {t} from "../shared/i18n";
import type {Defect, OperatorReport, PalletStatus} from "../shared/types";
import {type PalletID, normalizePalletId} from "../shared/validation";
import {encodeAuditDescription} from "./audit-description";

function reportAuditText(kind: "defect" | "washing", name: string, description: string): string {
    return kind === "washing" ? encodeAuditDescription("audit_operator_washing", {}, description)
        : name === "Other" ? encodeAuditDescription("audit_operator_report_other", {}, description)
        : encodeAuditDescription("audit_operator_report", {defect: name}, description);
}

interface Localized { acceptLanguage?: Header<"Accept-Language">; }
interface DefectInput extends Localized { name: string; }
interface DefectUpdate extends DefectInput { id: number; }
interface DefectID extends Localized { id: number; }

function defectName(name: string, lang?: string): string {
    const value = name?.trim();
    if (!value || value.length > 100) throw APIError.invalidArgument(t("defect_invalid", lang));
    return value;
}

export const GetDefects = api({method: "GET", path: "/defects", expose: true, auth: true},
    async (): Promise<{defects: Defect[]}> => {
        requireAuthenticatedUser();
        return {defects: await db.queryAll<Defect>`SELECT id, name FROM defects ORDER BY lower(name), id`};
    });

async function saveDefect(name: string, id: number | null, lang?: string): Promise<Defect> {
    requireMaintenanceUser();
    const value = defectName(name, lang);
    try {
        const result = id === null
            ? await db.queryRow<Defect>`INSERT INTO defects(name) VALUES (${value}) RETURNING id, name`
            : await db.queryRow<Defect>`UPDATE defects SET name = ${value} WHERE id = ${id} RETURNING id, name`;
        if (!result) throw APIError.notFound(t("defect_missing", lang));
        return result;
    } catch (error) {
        if (error instanceof APIError) throw error;
        if (String(error).includes("23505") || String(error).includes("duplicate key")) {
            throw APIError.alreadyExists(t("defect_invalid", lang));
        }
        throw error;
    }
}

export const AddDefect = api({method: "POST", path: "/defects", expose: true, auth: true},
    async (params: DefectInput): Promise<Defect> => saveDefect(params.name, null, params.acceptLanguage));
export const UpdateDefect = api({method: "PUT", path: "/defects/:id", expose: true, auth: true},
    async (params: DefectUpdate): Promise<Defect> => saveDefect(params.name, params.id, params.acceptLanguage));
export const DeleteDefect = api({method: "DELETE", path: "/defects/:id", expose: true, auth: true},
    async (params: DefectID): Promise<void> => {
        requireMaintenanceUser();
        const row = await db.queryRow<Defect>`DELETE FROM defects WHERE id = ${params.id} RETURNING id, name`;
        if (!row) throw APIError.notFound(t("defect_missing", params.acceptLanguage));
    });

interface ReportInput extends Localized {
    kind?: "defect" | "washing";
    pallet_id: PalletID;
    defect_id?: number | null;
    description?: string;
}
interface ReportUpdate extends ReportInput { id: number; version: number; }
type ReportRecord = Omit<OperatorReport, "created_at" | "closed_at" | "edited_at"> & {
    created_at: Date; closed_at: Date | null; edited_at: Date | null;
};
function reportDTO(row: ReportRecord): OperatorReport {
    return {...row, created_at: row.created_at.toISOString(), closed_at: row.closed_at?.toISOString() ?? null,
        edited_at: row.edited_at?.toISOString() ?? null};
}

export const GetOperatorReports = api({method: "GET", path: "/operator-reports", expose: true, auth: true},
    async (params: {pallet_id: Query<string>}): Promise<{reports: OperatorReport[]}> => {
        requireMaintenanceUser();
        const rows = await db.queryAll<ReportRecord>`SELECT * FROM operator_reports
            WHERE pallet_id = ${normalizePalletId(params.pallet_id)} AND closed_at IS NULL ORDER BY id DESC`;
        return {reports: rows.map(reportDTO)};
    });

export const CreateOperatorReport = api({method: "POST", path: "/operator-reports", expose: true, auth: true},
    async (params: ReportInput): Promise<OperatorReport> => {
        const auth = requireAuthenticatedUser();
        const palletId = normalizePalletId(params.pallet_id);
        const description = params.description?.trim() ?? "";
        const kind = params.kind ?? "defect";
        if (!palletId || !["defect", "washing"].includes(kind) || (kind === "washing" && params.defect_id != null) || description.length > 2000 || (kind === "defect" && !params.defect_id && !description)) {
            throw APIError.invalidArgument(t("report_invalid", params.acceptLanguage));
        }
        await using tx = await db.begin();
        const pallet = await tx.queryRow<{status: PalletStatus; block_reason: string | null}>`SELECT status, block_reason FROM pallets
            WHERE pallet_id = ${palletId} AND deleted_at IS NULL FOR UPDATE`;
        if (!pallet) throw APIError.notFound(t("pallet_not_found", params.acceptLanguage));
        if (pallet.status === "Blocked") throw APIError.permissionDenied(t("auth_operator_blocked", params.acceptLanguage));
        if (pallet.status === 'Damaged' && !auth.hasITDepartmentAccess && !auth.hasMEDepartmentAccess && !auth.hasURDepartmentAccess) {
            throw APIError.permissionDenied(t('auth_operator_damaged', params.acceptLanguage));
        }
        const defect = params.defect_id == null ? null : await tx.queryRow<Defect>`
            SELECT id, name FROM defects WHERE id = ${params.defect_id} FOR SHARE`;
        if (params.defect_id != null && !defect) throw APIError.invalidArgument(t("defect_missing", params.acceptLanguage));
        const name = kind === "washing" ? "Washing" : defect?.name ?? "Other";
        const text = reportAuditText(kind, name, description);
        const status: PalletStatus = kind === "washing" ? "Washing_Required" : "Damaged";
        const reason = text;
        // Insert exactly one event, including when the pallet was already damaged.
        await tx.exec`SELECT set_config('palletx.report_edit', 'on', true)`;
        await tx.exec`UPDATE pallets SET status = ${status}, block_reason = ${reason}, updated_at = NOW(),
            updated_by = ${auth.fullName}, last_operation_description = ${text} WHERE pallet_id = ${palletId}`;
        const audit = await tx.queryRow<{id: number}>`INSERT INTO pallet_audit_logs
            (pallet_id, operator_id, previous_status, new_status, description)
            VALUES (${palletId}, ${auth.fullName}, ${pallet.status}, ${status}, ${text}) RETURNING id`;
        const row = await tx.queryRow<ReportRecord>`INSERT INTO operator_reports
            (pallet_id, audit_log_id, kind, defect_id, defect_name, description, operator_id)
            VALUES (${palletId}, ${audit!.id}, ${kind}, ${defect?.id ?? null}, ${name}, ${description}, ${auth.fullName}) RETURNING *`;
        await tx.commit();
        return reportDTO(row!);
    });

export const EditOperatorReport = api({method: "PUT", path: "/operator-reports/:id", expose: true, auth: true},
    async (params: ReportUpdate): Promise<OperatorReport> => {
        const auth = requireMaintenanceUser();
        const palletId = normalizePalletId(params.pallet_id);
        const description = params.description?.trim() ?? "";
        if (!palletId || !Number.isSafeInteger(params.version) || params.version < 1 || description.length > 2000) {
            throw APIError.invalidArgument(t("report_invalid", params.acceptLanguage));
        }
        await using tx = await db.begin();
        // Lock pallet first, matching service completion and report creation.
        const pallet = await tx.queryRow<{status: PalletStatus; block_reason: string | null}>`SELECT status, block_reason FROM pallets
            WHERE pallet_id = ${palletId} AND deleted_at IS NULL FOR UPDATE`;
        if (!pallet) throw APIError.notFound(t("pallet_not_found", params.acceptLanguage));
        const old = await tx.queryRow<ReportRecord>`SELECT * FROM operator_reports
            WHERE id = ${params.id} AND pallet_id = ${palletId} FOR UPDATE`;
        if (!old || old.closed_at || old.version !== params.version) {
            throw APIError.aborted(t("report_conflict", params.acceptLanguage));
        }
        const defect = params.defect_id == null ? null : await tx.queryRow<Defect>`
            SELECT id, name FROM defects WHERE id = ${params.defect_id} FOR SHARE`;
        if (params.defect_id != null && !defect) throw APIError.invalidArgument(t("defect_missing", params.acceptLanguage));
        // A deleted catalog entry may retain its saved name until UR chooses another defect.
        const name = old.kind === "washing" ? "Washing" : defect?.name ?? (old.defect_id === null && old.defect_name !== "Other" && params.defect_id === undefined
            ? old.defect_name : "Other");
        if ((name === "Other" || old.kind === "washing") && !description) throw APIError.invalidArgument(t("report_invalid", params.acceptLanguage));
        if (old.kind === "washing" && params.defect_id != null) throw APIError.invalidArgument(t("report_invalid", params.acceptLanguage));
        const text = reportAuditText(old.kind, name, description);
        const row = await tx.queryRow<ReportRecord>`UPDATE operator_reports SET defect_id = ${defect?.id ?? null},
            defect_name = ${name}, description = ${description}, version = version + 1,
            edited_by = ${auth.fullName}, edited_at = NOW() WHERE id = ${old.id} RETURNING *`;
        await tx.exec`UPDATE pallet_audit_logs SET description = ${text} WHERE id = ${old.audit_log_id}`;
        const latest = await tx.queryRow<{id: number}>`SELECT id FROM operator_reports
            WHERE pallet_id = ${palletId} AND closed_at IS NULL ORDER BY id DESC LIMIT 1`;
        // Metadata edits do not detach a report from its current pallet comment.
        const previousReason = reportAuditText(old.kind, old.defect_name, old.description);
        if (latest?.id === old.id && pallet.status === (old.kind === 'washing' ? 'Washing_Required' : 'Damaged') && pallet.block_reason === previousReason) {
            await tx.exec`SELECT set_config('palletx.report_edit', 'on', true)`;
            await tx.exec`UPDATE pallets SET block_reason = ${text}, last_operation_description = ${text},
                updated_at = NOW() WHERE pallet_id = ${palletId}`;
        }
        await tx.commit();
        return reportDTO(row!);
    });
