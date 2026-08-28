import {randomUUID} from "node:crypto";
import {api} from "encore.dev/api";
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
}

interface WorkerRequest {
    limit?: number;
}

interface WorkerResponse {
    claimed: number;
    completed: number;
    retried: number;
    dead: number;
}

interface ReconcileResponse {
    queued: number;
}

const MAX_ATTEMPTS = 10;
const client = new FisClient(config.fis.requestTimeoutMs);

function routerForFis(fis: FisUnit): string {
    return fis === 1 ? config.fis.router1Url : config.fis.router2Url;
}

async function enqueue(
    tx: Transaction,
    palletId: string,
    operation: FisOutboxOperation,
    payload: FisOutboxPayload,
    idempotencyKey: string = randomUUID(),
): Promise<void> {
    await tx.exec`
        INSERT INTO fis_outbox (idempotency_key, pallet_id, operation, payload)
        VALUES (${idempotencyKey}::uuid, ${palletId}, ${operation}, ${JSON.stringify(payload)}::jsonb)
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

async function claimBatch(limit: number): Promise<FisOutboxRecord[]> {
    await using tx = await db.begin();
    await tx.exec`
        UPDATE fis_outbox
        SET status = 'pending', locked_at = NULL, available_at = NOW(),
            last_error = COALESCE(last_error, 'Worker lease expired before completion')
        WHERE status = 'processing'
          AND locked_at < NOW() - INTERVAL '15 minutes'
    `;
    const rows = await tx.queryAll<FisOutboxRecord>`
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
            LIMIT ${limit}
        )
        UPDATE fis_outbox AS jobs
        SET status = 'processing', locked_at = NOW(), attempts = attempts + 1
        FROM candidates
        WHERE jobs.id = candidates.id
        RETURNING jobs.id, jobs.operation, jobs.payload, jobs.attempts
    `;
    await tx.commit();
    return rows;
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

async function markCompleted(id: number): Promise<void> {
    await db.exec`
        UPDATE fis_outbox
        SET status = 'completed', processed_at = NOW(), locked_at = NULL, last_error = NULL
        WHERE id = ${id} AND status = 'processing'
    `;
}

async function markFailed(job: FisOutboxRecord, error: unknown): Promise<"retried" | "dead"> {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
    if (job.attempts >= MAX_ATTEMPTS) {
        await db.exec`
            UPDATE fis_outbox
            SET status = 'dead', locked_at = NULL, last_error = ${message}
            WHERE id = ${job.id} AND status = 'processing'
        `;
        return "dead";
    }

    const delaySeconds = Math.min(3600, 2 ** Math.min(job.attempts, 10) * 5);
    await db.exec`
        UPDATE fis_outbox
        SET status = 'pending', locked_at = NULL, last_error = ${message},
            available_at = NOW() + (${delaySeconds} * INTERVAL '1 second')
        WHERE id = ${job.id} AND status = 'processing'
    `;
    return "retried";
}

// This route is intentionally absent from nginx.conf. It is reachable only from
// the Compose network, where the scheduler containers call the Encore gateway.
export const ProcessFisOutbox = api(
    {method: "POST", path: "/internal/fis-outbox/process", expose: true},
    async (params: WorkerRequest): Promise<WorkerResponse> => {
        const requestedLimit = params.limit ?? 20;
        const limit = Number.isSafeInteger(requestedLimit)
            ? Math.max(1, Math.min(requestedLimit, 100))
            : 20;
        const jobs = await claimBatch(limit);
        const result: WorkerResponse = {claimed: jobs.length, completed: 0, retried: 0, dead: 0};

        for (const job of jobs) {
            try {
                await executeJob(job);
                await markCompleted(job.id);
                result.completed += 1;
            } catch (error) {
                const disposition = await markFailed(job, error);
                result[disposition] += 1;
                console.error(`FIS outbox job ${job.id} failed`, error);
            }
        }
        return result;
    },
);

export const ReconcileFisOutbox = api(
    {method: "POST", path: "/internal/fis-outbox/reconcile", expose: true},
    async (): Promise<ReconcileResponse> => {
        await using tx = await db.begin();
        const state = await tx.queryRow<{last_pallet_id: number}>`
            SELECT last_pallet_id FROM fis_reconciliation_state
            WHERE singleton = TRUE FOR UPDATE
        `;
        const afterId = state?.last_pallet_id ?? 0;
        let rows = await tx.queryAll<{
            id: number;
            pallet_id: string;
            project: string;
            model: string;
            fis: FisUnit;
            deleted_at: Date | null;
        }>`
            SELECT id, pallet_id, project, model, fis, deleted_at
            FROM pallets WHERE id > ${afterId}
            ORDER BY id LIMIT 50
        `;
        if (rows.length === 0 && afterId > 0) {
            rows = await tx.queryAll`
                SELECT id, pallet_id, project, model, fis, deleted_at
                FROM pallets ORDER BY id LIMIT 50
            `;
        }

        const bucket = new Date().toISOString().slice(0, 10);
        for (const row of rows) {
            const keySource = `${bucket}:${row.id}:${row.deleted_at ? "deleted" : "active"}`;
            // PostgreSQL derives a stable UUID from the daily reconciliation key.
            const idempotencyKey = await tx.queryRow<{id: string}>`
                SELECT md5(${keySource})::uuid AS id
            `;
            if (row.deleted_at) {
                await enqueue(tx, row.pallet_id, "DELETE", {fis: row.fis, pallet_id: row.pallet_id}, idempotencyKey!.id);
            } else {
                await enqueue(tx, row.pallet_id, "SYNC", {
                    fis: row.fis,
                    details: {pallet_id: row.pallet_id, project: row.project, model: row.model},
                    operator: "SYSTEM_RECONCILIATION",
                    only_if_missing: true,
                }, idempotencyKey!.id);
            }
        }

        const lastId = rows.at(-1)?.id ?? 0;
        await tx.exec`
            UPDATE fis_reconciliation_state
            SET last_pallet_id = ${lastId}, updated_at = NOW()
            WHERE singleton = TRUE
        `;
        await tx.commit();
        return {queued: rows.length};
    },
);
