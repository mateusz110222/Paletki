import {api, APIError, Header, Query} from "encore.dev/api";
import {db} from "./db";
import {requireMaintenanceUser} from "../shared/authorization";
import {t} from "../shared/i18n";
import {PALLET_STATUSES, type ReportRow} from "../shared/types";
import {AUDIT_STATUS_COMMENT_KEYS, getAuditStatusReason, localizeAuditDescription} from "./audit-description";


type ReportRecord = ReportRow & {
    current_block_reason?: string | null;
    current_damage_reason?: string | null;
    block_reason_updated?: boolean;
};

interface ReportParams {
    mode: Query<"history" | "current">;
    from?: Query<string>; to?: Query<string>; statuses?: Query<string>;
    previous_status?: Query<string>; changes_only?: Query<boolean>;
    limit?: Query<number>; offset?: Query<number>;
    before_timestamp?: Query<string>; before_id?: Query<number>;
    acceptLanguage?: Header<"Accept-Language">;
}


export function validReportDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const GetReports = api({method: "GET", path: "/pallets/reports", expose: true, auth: true},
    async (params: ReportParams): Promise<{rows: ReportRow[]; next_offset?: number; next_before_timestamp?: string; next_before_id?: number}> => {
        requireMaintenanceUser();
        const from = params.from || null;
        const to = params.to || null;
        const statuses = params.statuses?.split(",").filter(Boolean) ?? [];
        const previousStatus = params.previous_status || null;
        const changesOnly = params.changes_only ?? false;
        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;
        const beforeTimestamp = params.before_timestamp || null;
        const beforeId = params.before_id ?? null;
        const hasCursor = beforeTimestamp !== null || beforeId !== null;
        if (!['history', 'current'].includes(params.mode) || (from && !validReportDate(from)) ||
            (to && !validReportDate(to)) || (from && to && from > to) ||
            statuses.some(status => !PALLET_STATUSES.includes(status as typeof PALLET_STATUSES[number])) ||
            (previousStatus !== null && !PALLET_STATUSES.includes(previousStatus as typeof PALLET_STATUSES[number])) ||
            (params.mode === "current" && (previousStatus !== null || changesOnly)) ||
            !Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0 ||
            (hasCursor && (!beforeTimestamp || !Number.isFinite(Date.parse(beforeTimestamp)) || beforeId === null || !Number.isSafeInteger(beforeId) || beforeId < 1))) {
            throw APIError.invalidArgument(t("report_dates_invalid", params.acceptLanguage));
        }
        const effectiveOffset = hasCursor ? 0 : offset;
        const statusFilter = statuses.join(",");
        const palletStatuses = PALLET_STATUSES.join(",");
        const rows = params.mode === "history"
            ? await db.queryAll<ReportRecord>`SELECT a.id, a.pallet_id, p.project, p.model, p.machine,
                a.previous_status, a.new_status AS status, to_char(a.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS timestamp,
                CASE WHEN r.kind = 'defect' THEN r.defect_name END AS defect,
                a.description, a.operator_id AS operator, blocking.description AS block_reason,
                blocking.previous_description AS previous_block_reason,
                (a.previous_status = 'Blocked' AND a.new_status = 'Blocked' AND blocking.id = a.id) AS block_reason_updated,
                damage.description AS damage_reason,
                CASE WHEN p.status = 'Blocked' AND p.status_changed_at = blocking.timestamp
                    THEN p.block_reason END AS current_block_reason,
                CASE WHEN p.status = 'Damaged' AND p.status_changed_at = damage.timestamp
                    THEN p.block_reason END AS current_damage_reason
                FROM pallet_audit_logs a JOIN pallet_details p ON p.pallet_id = a.pallet_id
                LEFT JOIN operator_reports r ON r.audit_log_id = a.id
                LEFT JOIN LATERAL (
                    SELECT b.id, b.description, b.timestamp,
                        lead(b.description) OVER (ORDER BY b.id DESC) AS previous_description
                    FROM (
                        SELECT id, description, timestamp FROM pallet_audit_logs b
                        WHERE (a.previous_status = 'Blocked' OR a.new_status = 'Blocked')
                          AND b.pallet_id = a.pallet_id AND b.id <= a.id AND b.new_status = 'Blocked'
                          AND (b.previous_status <> 'Blocked' OR CASE
                              WHEN starts_with(b.description, 'i18n:') AND substring(b.description from 6) IS JSON OBJECT
                              THEN (substring(b.description from 6)::jsonb ->> 'key') = ANY(string_to_array(${AUDIT_STATUS_COMMENT_KEYS.join(",")}, ','))
                                  AND NULLIF(BTRIM(substring(b.description from 6)::jsonb ->> 'comment'), '') IS NOT NULL
                              ELSE false END)
                        ORDER BY b.id DESC LIMIT 2
                    ) b
                    ORDER BY b.id DESC LIMIT 1
                ) blocking ON true
                LEFT JOIN LATERAL (
                    SELECT d.description, d.timestamp FROM pallet_audit_logs d
                    WHERE (a.previous_status = 'Damaged' OR a.new_status = 'Damaged')
                      AND d.pallet_id = a.pallet_id AND d.id <= a.id AND d.new_status = 'Damaged'
                      AND (d.previous_status <> 'Damaged' OR EXISTS (
                          SELECT 1 FROM operator_reports defect WHERE defect.audit_log_id = d.id AND defect.kind = 'defect'
                      ))
                    ORDER BY d.id DESC LIMIT 1
                ) damage ON true
                WHERE (${from}::date IS NULL OR a.timestamp >= (${from}::date::timestamp AT TIME ZONE 'Europe/Warsaw'))
                  AND (${to}::date IS NULL OR a.timestamp < ((${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Warsaw'))
                  AND (${statusFilter} = '' OR a.new_status = ANY(string_to_array(${statusFilter}, ',')))
                  AND (${previousStatus}::text IS NULL OR a.previous_status = ${previousStatus})
                  AND (NOT ${changesOnly}::boolean OR (
                    a.previous_status <> a.new_status
                    AND a.previous_status = ANY(string_to_array(${palletStatuses}, ','))
                    AND a.new_status = ANY(string_to_array(${palletStatuses}, ','))
                  ))
                  AND (${beforeTimestamp}::timestamptz IS NULL OR (a.timestamp, a.id) < (${beforeTimestamp}::timestamptz, ${beforeId}::int))
                ORDER BY a.timestamp DESC, a.id DESC LIMIT ${limit + 1} OFFSET ${effectiveOffset}`
            : await db.queryAll<ReportRecord>`SELECT p.id, p.pallet_id, p.project, p.model, p.machine,
                NULL::text AS previous_status, p.status, to_char(p.status_changed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS timestamp,
                CASE WHEN r.kind = 'defect' THEN r.defect_name END AS defect, COALESCE(p.block_reason, '') AS description,
                CASE WHEN p.status='Washing_Required' AND a.timestamp IS NULL THEN 'System' ELSE COALESCE(a.operator_id,p.created_by) END AS operator
                FROM pallet_details p
                LEFT JOIN LATERAL (SELECT timestamp, operator_id FROM pallet_audit_logs
                    WHERE pallet_id = p.pallet_id AND new_status = p.status AND previous_status <> new_status
                      AND timestamp = p.status_changed_at
                    ORDER BY id DESC LIMIT 1) a ON true
                LEFT JOIN LATERAL (SELECT defect_name, kind FROM operator_reports
                    WHERE pallet_id = p.pallet_id AND closed_at IS NULL ORDER BY id DESC LIMIT 1) r ON true
                WHERE p.deleted_at IS NULL
                  AND (${from}::date IS NULL OR p.status_changed_at >= (${from}::date::timestamp AT TIME ZONE 'Europe/Warsaw'))
                  AND (${to}::date IS NULL OR p.status_changed_at < ((${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Warsaw'))
                  AND (${statusFilter} = '' OR p.status = ANY(string_to_array(${statusFilter}, ',')))
                  AND (${beforeTimestamp}::timestamptz IS NULL OR (p.status_changed_at, p.id) < (${beforeTimestamp}::timestamptz, ${beforeId}::int))
                ORDER BY p.status_changed_at DESC, p.id DESC LIMIT ${limit + 1} OFFSET ${effectiveOffset}`;
        const hasMore = rows.length > limit;
        const pageRows = rows.slice(0, limit);
        const lastRow = pageRows.at(-1);
        const statusReason = (audit: string | null | undefined, current: string | null | undefined) =>
            getAuditStatusReason(audit ?? null, params.acceptLanguage)
            ?? (current ? localizeAuditDescription(current, params.acceptLanguage) : null);
        return {
            rows: pageRows.map(({current_block_reason, current_damage_reason, block_reason_updated, previous_block_reason, ...row}) => ({...row, timestamp: new Date(row.timestamp).toISOString(),
                ...(params.mode === 'history' ? {
                    block_reason: statusReason(row.block_reason, current_block_reason),
                    damage_reason: statusReason(row.damage_reason, current_damage_reason),
                    ...(block_reason_updated ? {previous_block_reason: getAuditStatusReason(previous_block_reason ?? null, params.acceptLanguage)} : {}),
                } : {}),
                description: localizeAuditDescription(row.description, params.acceptLanguage)})),
            next_offset: hasMore ? effectiveOffset + limit : undefined,
            next_before_timestamp: hasMore && lastRow ? lastRow.timestamp : undefined,
            next_before_id: hasMore && lastRow ? lastRow.id : undefined,
        };
    });
