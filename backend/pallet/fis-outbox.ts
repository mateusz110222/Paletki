import {randomUUID, timingSafeEqual} from "node:crypto";
import {api, APIError, type Header} from "encore.dev/api";
import type {Transaction} from "encore.dev/storage/sqldb";
import {config} from "../config";
import type {FisUnit} from "../shared/validation";
import {db} from "./db";
import {FisClient, type FisUnitDetails} from "./fis-client";
import {
    decodeFisOutboxPayload,
    type DeletePayload,
    type FisOutboxOperation,
    type FisOutboxPayload,
    type MigratePayload,
    type SyncPayload,
} from "./fis-outbox-payload";

interface FisOutboxRecord {
    id: number;
    operation: FisOutboxOperation;
    payload: unknown;
    attempts: number;
    lease_token: string;
}

interface WorkerCredentials {
    workerToken?: Header<"X-FIS-Worker-Token">;
}

interface WorkerRequest extends WorkerCredentials {
    limit?: number;
}

interface WorkerResponse {
    claimed: number;
    completed: number;
    retried: number;
    dead: number;
    pruned: number;
}

interface ReconcileResponse {
    queued: number;
}

const MAX_ATTEMPTS = 10;
const client = new FisClient(config.fis.requestTimeoutMs);

function requireWorkerToken(token?: string): void {
    const expected = Buffer.from(config.fis.outboxWorkerToken);
    const supplied = Buffer.from(token ?? "");
    if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        throw APIError.unauthenticated("Invalid FIS worker credentials.");
    }
}

function routerForFis(fis: FisUnit): string {
    return fis === 1 ? config.fis.router1Url : config.fis.router2Url;
}

async function enqueue(
    tx: Transaction,
    palletId: string,
    operation: FisOutboxOperation,
    payload: FisOutboxPayload,
): Promise<void> {
    await tx.exec`
        INSERT INTO fis_outbox (idempotency_key, pallet_id, operation, payload)
        VALUES (${randomUUID()}::uuid, ${palletId}, ${operation}, ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING
    `;
}

export function enqueueFisSync(
    tx: Transaction,
    fis: FisUnit,
    details: FisUnitDetails,
    operator: string,
): Promise<void> {
    return enqueue(tx, details.pallet_id, "SYNC", {fis, details, operator});
}

export function enqueueFisMigration(
    tx: Transaction,
    previousFis: FisUnit,
    fis: FisUnit,
    details: FisUnitDetails,
    operator: string,
): Promise<void> {
    return enqueue(tx, details.pallet_id, "MIGRATE", {
        previous_fis: previousFis,
        fis,
        details,
        operator,
    });
}

export function enqueueFisDelete(tx: Transaction, fis: FisUnit, palletId: string): Promise<void> {
    return enqueue(tx, palletId, "DELETE", {fis, pallet_id: palletId});
}

async function recoverExpiredLeases(): Promise<void> {
    // Cover one complete FIS operation, including failed-create cleanup.
    const leaseSeconds = Math.max(900, Math.ceil(config.fis.requestTimeoutMs / 1000) * 6 + 60);
    await db.exec`
        UPDATE fis_outbox
        SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'dead' ELSE 'pending' END,
            locked_at = NULL, lease_token = NULL, available_at = NOW(),
            last_error = COALESCE(last_error, 'Worker lease expired before completion')
        WHERE (status = 'processing' AND locked_at < NOW() - (${leaseSeconds} * INTERVAL '1 second'))
           OR (status = 'pending' AND attempts >= ${MAX_ATTEMPTS})
    `;
}

async function claimNext(): Promise<FisOutboxRecord | null> {
    const leaseToken = randomUUID();
    const row = await db.queryRow<FisOutboxRecord>`
        WITH candidates AS (
            SELECT candidate.id
            FROM fis_outbox AS candidate
            WHERE candidate.status = 'pending'
              AND candidate.available_at <= NOW()
              AND NOT EXISTS (
                  SELECT 1
                  FROM fis_outbox AS earlier
                  WHERE earlier.pallet_id = candidate.pallet_id
                    AND earlier.id < candidate.id
                    AND earlier.status IN ('pending', 'processing')
              )
            ORDER BY candidate.id
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        UPDATE fis_outbox AS jobs
        SET status = 'processing', locked_at = NOW(), lease_token = ${leaseToken}::uuid, attempts = attempts + 1
        FROM candidates
        WHERE jobs.id = candidates.id
        RETURNING jobs.id, jobs.operation, jobs.payload, jobs.attempts, jobs.lease_token
    `;
    return row;
}

async function executeJob(job: FisOutboxRecord): Promise<void> {
    const decoded = decodeFisOutboxPayload(job.operation, job.payload);
    if (job.operation === "DELETE") {
        const payload = decoded as DeletePayload;
        await client.deleteUnitIfPresent(routerForFis(payload.fis), payload.pallet_id);
        return;
    }

    const payload = decoded as SyncPayload;
    if (payload.only_if_missing) {
        await client.ensureUnitPresent(routerForFis(payload.fis), payload.details, payload.operator);
    } else {
        await client.synchronizeUnit(routerForFis(payload.fis), payload.details, payload.operator);
    }
    if (job.operation === "MIGRATE") {
        const migration = payload as MigratePayload;
        if (migration.previous_fis !== migration.fis) {
            await client.deleteUnitIfPresent(routerForFis(migration.previous_fis), migration.details.pallet_id);
        }
    }
}

async function markCompleted(job: FisOutboxRecord): Promise<boolean> {
    const row = await db.queryRow<{id: number}>`
        UPDATE fis_outbox
        SET status = 'completed', processed_at = NOW(), locked_at = NULL, lease_token = NULL, last_error = NULL
        WHERE id = ${job.id} AND status = 'processing' AND lease_token = ${job.lease_token}::uuid
        RETURNING id
    `;
    return row !== null;
}

async function markFailed(job: FisOutboxRecord, error: unknown): Promise<"retried" | "dead" | null> {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
    const dead = job.attempts >= MAX_ATTEMPTS;
    const delaySeconds = Math.min(3600, 2 ** Math.min(job.attempts, 10) * 5);
    const row = await db.queryRow<{id: number}>`
        UPDATE fis_outbox
        SET status = ${dead ? "dead" : "pending"}, locked_at = NULL, lease_token = NULL, last_error = ${message},
            available_at = NOW() + (${delaySeconds} * INTERVAL '1 second')
        WHERE id = ${job.id} AND status = 'processing' AND lease_token = ${job.lease_token}::uuid
        RETURNING id
    `;
    return row ? (dead ? "dead" : "retried") : null;
}

async function pruneCompletedJobs(): Promise<number> {
    await db.exec`DELETE FROM auth_sessions WHERE expires_at <= NOW()`;
    const result = await db.queryRow<{deleted_count: number}>`
        WITH candidates AS (
            SELECT id
            FROM fis_outbox
            WHERE status = 'completed'
              AND processed_at < NOW() - (${config.fis.outboxCompletedRetentionDays} * INTERVAL '1 day')
            ORDER BY processed_at, id
            LIMIT 1000
        ), deleted AS (
            DELETE FROM fis_outbox AS jobs
            USING candidates
            WHERE jobs.id = candidates.id
            RETURNING jobs.id
        )
        SELECT COUNT(*)::int AS deleted_count FROM deleted
    `;
    return result?.deleted_count ?? 0;
}

// This route is intentionally absent from nginx.conf. It is reachable only from
// the Compose network, where the scheduler containers call the Encore gateway.
export const ProcessFisOutbox = api(
    {method: "POST", path: "/internal/fis-outbox/process", expose: true, sensitive: true},
    async (params: WorkerRequest): Promise<WorkerResponse> => {
        requireWorkerToken(params.workerToken);
        const requestedLimit = params.limit ?? 20;
        const limit = Number.isSafeInteger(requestedLimit)
            ? Math.max(1, Math.min(requestedLimit, 100))
            : 20;
        const result: WorkerResponse = {claimed: 0, completed: 0, retried: 0, dead: 0, pruned: 0};
        await recoverExpiredLeases();

        for (let index = 0; index < limit; index++) {
            const job = await claimNext();
            if (!job) break;
            result.claimed += 1;
            try {
                await executeJob(job);
                if (await markCompleted(job)) result.completed += 1;
                else console.warn(`FIS outbox job ${job.id} lease was lost`);
            } catch (error) {
                const disposition = await markFailed(job, error);
                if (disposition) result[disposition] += 1;
                console.error(`FIS outbox job ${job.id} failed`, error);
            }
        }
        try {
            result.pruned = await pruneCompletedJobs();
        } catch (error) {
            console.error("Could not prune completed FIS outbox jobs", error);
        }
        return result;
    },
);

export const ReconcileFisOutbox = api(
    {method: "POST", path: "/internal/fis-outbox/reconcile", expose: true, sensitive: true},
    async (params: WorkerCredentials): Promise<ReconcileResponse> => {
        requireWorkerToken(params.workerToken);
        await using tx = await db.begin();
        const state = await tx.queryRow<{last_pallet_id: number}>`
            SELECT last_pallet_id FROM fis_reconciliation_state
            WHERE singleton = TRUE FOR UPDATE
        `;
        const afterId = state?.last_pallet_id ?? 0;
        const bucket = new Date().toISOString().slice(0, 10);
        const result = await tx.queryRow<ReconcileResponse>`
            WITH batch AS MATERIALIZED (
                SELECT a.id, a.pallet_id, a.fis, a.deleted_at, p.name AS project, m.name AS model
                FROM pallets a JOIN projects p ON p.id = a.project_id
                JOIN pallet_models m ON m.id = a.model_id AND m.project_id = a.project_id
                WHERE a.id > CASE WHEN EXISTS (SELECT 1 FROM pallets WHERE id > ${afterId}) THEN ${afterId} ELSE 0 END
                ORDER BY a.id LIMIT 50 FOR UPDATE OF a
            ), enqueued AS (
                INSERT INTO fis_outbox (idempotency_key, pallet_id, operation, payload)
                SELECT md5(concat(${bucket}::text, ':', id, ':', CASE WHEN deleted_at IS NULL THEN 'active' ELSE 'deleted' END))::uuid,
                    pallet_id, CASE WHEN deleted_at IS NULL THEN 'SYNC' ELSE 'DELETE' END,
                    CASE WHEN deleted_at IS NULL THEN jsonb_build_object('fis', fis,
                        'details', jsonb_build_object('pallet_id', pallet_id, 'project', project, 'model', model),
                        'operator', 'SYSTEM_RECONCILIATION', 'only_if_missing', true)
                    ELSE jsonb_build_object('fis', fis, 'pallet_id', pallet_id) END
                FROM batch ORDER BY id ON CONFLICT (idempotency_key) DO NOTHING
            )
            UPDATE fis_reconciliation_state
            SET last_pallet_id = COALESCE((SELECT MAX(id) FROM batch), 0), updated_at = NOW()
            WHERE singleton = TRUE
            RETURNING (SELECT COUNT(*)::int FROM batch) AS queued
        `;
        await tx.commit();
        return result ?? {queued: 0};
    },
);
