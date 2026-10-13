import {api, Query} from "encore.dev/api";
import {db} from "./db";
import type {PalletStatus, ProductionStation, PublicDashboardResponse} from "../shared/types";
import {normalizeStation} from "../shared/validation";

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

interface DashboardParams {
    station?: Query<string>;
}

interface ProductionStationRecord extends Omit<ProductionStation, "updated_at"> {
    updated_at: Date;
}

/**
 * Read-only, deliberately limited data feed for unattended shop-floor screens.
 * It exposes operational pallet state, but no employee names, comments, block
 * reasons or audit records.
 */
export const GetPublicDashboard = api(
    {method: "GET", path: "/public/dashboard", expose: true},
    async (params: DashboardParams): Promise<PublicDashboardResponse> => {
        const requestedStation = params.station ? normalizeStation(params.station) : null;
        const showAll = requestedStation === "ALL";
        const stationRows = await db.queryAll<ProductionStationRecord>`
            SELECT DISTINCT ON (stations.station)
                   stations.station, stations.pallet_id, pallets.project, pallets.model, stations.updated_at
            FROM production_stations stations
            JOIN pallet_details pallets ON pallets.pallet_id = stations.pallet_id AND pallets.deleted_at IS NULL
            ORDER BY stations.station, stations.updated_at DESC, stations.pallet_id DESC
        `;
        const stations = stationRows.map((station) => ({
            ...station,
            updated_at: station.updated_at.toISOString(),
        }));
        const selectedStation = requestedStation && !showAll
            ? stations.find((station) => station.station === requestedStation) ?? null
            : null;
        const stationHistoryRows = requestedStation && !showAll
            ? await db.queryAll<ProductionStationRecord>`
                SELECT stations.station, stations.pallet_id, pallets.project, pallets.model, stations.updated_at
                FROM production_stations stations
                JOIN pallet_details pallets ON pallets.pallet_id = stations.pallet_id AND pallets.deleted_at IS NULL
                WHERE stations.station = ${requestedStation}
                ORDER BY stations.updated_at DESC, stations.pallet_id DESC
                LIMIT 3
            `
            : [];
        const stationHistory = stationHistoryRows.map((station) => ({
            ...station,
            updated_at: station.updated_at.toISOString(),
        }));
        const selectedProjects = [...new Set(stationHistory.map((entry) => entry.project))];

        const pallets = await db.queryAll<DashboardPalletRecord>`
            SELECT
                p.pallet_id,
                p.project,
                p.model,
                p.status,
                p.current_cycles,
                p.max_cycles,
                p.status_changed_at
            FROM pallet_details p
            WHERE p.deleted_at IS NULL
              AND (
                  ${showAll}::boolean
                  OR p.project = ANY(${selectedProjects}::text[])
              )
            ORDER BY p.id
        `;

        const daily = await db.queryAll<ServiceDayRecord>`
            WITH completed_service AS (
                SELECT
                    finished.timestamp AS finished_at,
                    EXTRACT(EPOCH FROM (finished.timestamp - started.timestamp)) / 60.0 AS duration_minutes
                FROM (SELECT pallet_id, started_at, finished_at AS timestamp FROM pallet_service_periods WHERE completed) finished
                JOIN pallet_details serviced_pallet ON serviced_pallet.pallet_id = finished.pallet_id
                CROSS JOIN LATERAL (SELECT finished.started_at AS timestamp) started
                WHERE finished.timestamp >= CURRENT_DATE - INTERVAL '13 days'
                  AND (
                      ${showAll}::boolean
                      OR serviced_pallet.project = ANY(${selectedProjects}::text[])
                  )
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
                FROM (SELECT pallet_id, started_at, finished_at AS timestamp FROM pallet_service_periods WHERE completed) finished
                JOIN pallet_details serviced_pallet ON serviced_pallet.pallet_id = finished.pallet_id
                CROSS JOIN LATERAL (SELECT finished.started_at AS timestamp) started
                WHERE finished.timestamp >= NOW() - INTERVAL '30 days'
                  AND (
                      ${showAll}::boolean
                      OR serviced_pallet.project = ANY(${selectedProjects}::text[])
                  )
            ) durations
        `;

        return {
            generated_at: new Date().toISOString(),
            scope: showAll ? "all" : selectedStation ? "station" : "selection",
            stations,
            selected_station: selectedStation,
            station_history: stationHistory,
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
