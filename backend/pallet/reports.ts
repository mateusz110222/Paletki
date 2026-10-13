import {api, APIError, Header, Query} from "encore.dev/api";
import {db} from "./db";
import {requireMaintenanceUser} from "../shared/authorization";
import {t} from "../shared/i18n";
import {PALLET_STATUSES, type ReportRow} from "../shared/types";
import {localizeAuditDescription} from "./audit-description";


interface ReportParams {
    mode: Query<"history" | "current">;
    from?: Query<string>; to?: Query<string>; statuses?: Query<string>;
    limit?: Query<number>; offset?: Query<number>;
    acceptLanguage?: Header<"Accept-Language">;
}
type RowRecord = Omit<ReportRow, "timestamp"> & {timestamp: Date};

export function validReportDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const GetReports = api({method: "GET", path: "/pallets/reports", expose: true, auth: true},
    async (params: ReportParams): Promise<{rows: ReportRow[]; next_offset?: number}> => {
        requireMaintenanceUser();
        const from = params.from || null;
        const to = params.to || null;
        const statuses = params.statuses?.split(",").filter(Boolean) ?? [];
        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;
        if (!['history', 'current'].includes(params.mode) || (from && !validReportDate(from)) ||
            (to && !validReportDate(to)) || (from && to && from > to) ||
            statuses.some(status => !PALLET_STATUSES.includes(status as typeof PALLET_STATUSES[number])) ||
            !Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) {
            throw APIError.invalidArgument(t("report_dates_invalid", params.acceptLanguage));
        }
        const statusFilter = statuses.join(",");
        const rows = params.mode === "history"
            ? await db.queryAll<RowRecord>`SELECT a.id, a.pallet_id, p.project, p.model, p.machine,
                a.previous_status, a.new_status AS status, a.timestamp, CASE WHEN r.kind = 'defect' THEN r.defect_name END AS defect,
                a.description, a.operator_id AS operator
                FROM pallet_audit_logs a JOIN pallet_details p ON p.pallet_id = a.pallet_id
                LEFT JOIN operator_reports r ON r.audit_log_id = a.id
                WHERE (${from}::date IS NULL OR a.timestamp >= (${from}::date::timestamp AT TIME ZONE 'Europe/Warsaw'))
                  AND (${to}::date IS NULL OR a.timestamp < ((${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Warsaw'))
                  AND (${statusFilter} = '' OR a.new_status = ANY(string_to_array(${statusFilter}, ',')))
                ORDER BY a.timestamp DESC, a.id DESC LIMIT ${limit + 1} OFFSET ${offset}`
            : await db.queryAll<RowRecord>`SELECT p.id, p.pallet_id, p.project, p.model, p.machine,
                NULL::text AS previous_status, p.status, p.status_changed_at AS timestamp,
                CASE WHEN r.kind = 'defect' THEN r.defect_name END AS defect, COALESCE(p.block_reason, '') AS description,
                CASE WHEN p.status='Washing_Required' AND a.timestamp IS NULL THEN 'System' ELSE COALESCE(a.operator_id,p.created_by) END AS operator
                FROM pallet_details p
                LEFT JOIN LATERAL (SELECT timestamp, operator_id FROM pallet_audit_logs
                    WHERE pallet_id = p.pallet_id AND new_status = p.status AND previous_status <> new_status
                    ORDER BY id DESC LIMIT 1) a ON true
                LEFT JOIN LATERAL (SELECT defect_name, kind FROM operator_reports
                    WHERE pallet_id = p.pallet_id AND closed_at IS NULL ORDER BY id DESC LIMIT 1) r ON true
                WHERE p.deleted_at IS NULL
                  AND (${from}::date IS NULL OR p.status_changed_at >= (${from}::date::timestamp AT TIME ZONE 'Europe/Warsaw'))
                  AND (${to}::date IS NULL OR p.status_changed_at < ((${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Warsaw'))
                  AND (${statusFilter} = '' OR p.status = ANY(string_to_array(${statusFilter}, ',')))
                ORDER BY timestamp DESC, p.id DESC LIMIT ${limit + 1} OFFSET ${offset}`;
        return {
            rows: rows.slice(0, limit).map(row => ({...row, timestamp: row.timestamp.toISOString(),
                description: localizeAuditDescription(row.description, params.acceptLanguage)})),
            next_offset: rows.length > limit ? offset + limit : undefined,
        };
    });
