import {api} from "encore.dev/api";
import {db} from "./db";
import type {PalletStatus, PublicDashboardResponse} from "../shared/types";

interface DashboardPalletRecord {
    pallet_id: string;
    project: string;
    model: string;
    status: PalletStatus;
    current_cycles: number;
    max_cycles: number;
    status_changed_at: Date;
}

interface ServiceDayRecord {
    day: string;
    completed: number;
    average_minutes: number;
}

interface ServiceSummaryRecord {
    completed: number;
    average_minutes: number;
}

/**
 * Read-only, deliberately limited data feed for unattended shop-floor screens.
 * It exposes operational pallet state, but no employee names, comments, block
 * reasons or audit records.
 */
export const GetPublicDashboard = api(
    {method: "GET", path: "/public/dashboard", expose: true},
    async (): Promise<PublicDashboardResponse> => {
        const pallets = await db.queryAll<DashboardPalletRecord>`
            SELECT
                p.pallet_id,
                p.project,
                p.model,
                p.status,
                p.current_cycles,
                p.max_cycles,
                COALESCE(status_change.timestamp, p.updated_at) AS status_changed_at
            FROM pallets p
            LEFT JOIN LATERAL (
                SELECT timestamp
                FROM pallet_audit_logs
                WHERE pallet_id = p.pallet_id
                  AND new_status = p.status
                  AND previous_status <> new_status
                ORDER BY id DESC
                LIMIT 1
            ) status_change ON TRUE
            WHERE p.deleted_at IS NULL
            ORDER BY p.id
        `;

        const daily = await db.queryAll<ServiceDayRecord>`
            WITH completed_service AS (
                SELECT
                    finished.timestamp AS finished_at,
                    EXTRACT(EPOCH FROM (finished.timestamp - started.timestamp)) / 60.0 AS duration_minutes
                FROM pallet_audit_logs finished
                JOIN LATERAL (
                    SELECT timestamp
                    FROM pallet_audit_logs started
                    WHERE started.pallet_id = finished.pallet_id
                      AND started.id < finished.id
                      AND started.new_status = finished.previous_status
                      AND started.previous_status <> started.new_status
                    ORDER BY started.id DESC
                    LIMIT 1
                ) started ON TRUE
                WHERE finished.new_status = 'Active'
                  AND finished.previous_status IN ('Washing_Required', 'Damaged')
                  AND finished.timestamp >= CURRENT_DATE - INTERVAL '13 days'
            ), days AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '13 days',
                    CURRENT_DATE,
                    INTERVAL '1 day'
                )::date AS day
            )
            SELECT
                TO_CHAR(days.day, 'YYYY-MM-DD') AS day,
                COUNT(completed_service.finished_at)::int AS completed,
                COALESCE(ROUND(AVG(completed_service.duration_minutes))::int, 0) AS average_minutes
            FROM days
            LEFT JOIN completed_service
              ON completed_service.finished_at::date = days.day
            GROUP BY days.day
            ORDER BY days.day
        `;

        const serviceSummary = await db.queryRow<ServiceSummaryRecord>`
            SELECT
                COUNT(*)::int AS completed,
                COALESCE(ROUND(AVG(duration_minutes))::int, 0) AS average_minutes
            FROM (
                SELECT EXTRACT(EPOCH FROM (finished.timestamp - started.timestamp)) / 60.0 AS duration_minutes
                FROM pallet_audit_logs finished
                JOIN LATERAL (
                    SELECT timestamp
                    FROM pallet_audit_logs started
                    WHERE started.pallet_id = finished.pallet_id
                      AND started.id < finished.id
                      AND started.new_status = finished.previous_status
                      AND started.previous_status <> started.new_status
                    ORDER BY started.id DESC
                    LIMIT 1
                ) started ON TRUE
                WHERE finished.new_status = 'Active'
                  AND finished.previous_status IN ('Washing_Required', 'Damaged')
                  AND finished.timestamp >= NOW() - INTERVAL '30 days'
            ) durations
        `;

        return {
            generated_at: new Date().toISOString(),
            pallets: pallets.map((pallet) => ({
                ...pallet,
                status_changed_at: pallet.status_changed_at.toISOString(),
            })),
            service: {
                average_minutes_30d: serviceSummary?.average_minutes ?? 0,
                completed_30d: serviceSummary?.completed ?? 0,
                daily: daily.map((point) => ({
                    day: point.day,
                    completed: point.completed,
                    average_minutes: point.average_minutes,
                })),
            },
        };
    },
);
