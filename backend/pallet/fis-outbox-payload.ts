import type {FisUnit} from "../shared/validation";
import type {FisUnitDetails} from "./fis-client";

export type FisOutboxOperation = "SYNC" | "MIGRATE" | "DELETE";

export interface SyncPayload {
    fis: FisUnit;
    details: FisUnitDetails;
    operator: string;
    only_if_missing?: boolean;
}

export interface MigratePayload extends SyncPayload {
    previous_fis: FisUnit;
}

export interface DeletePayload {
    fis: FisUnit;
    pallet_id: string;
}

export type FisOutboxPayload = SyncPayload | MigratePayload | DeletePayload;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonValue(value: unknown): unknown {
    if (typeof value === "string") return JSON.parse(value);
    if (value instanceof Uint8Array) return JSON.parse(Buffer.from(value).toString("utf8"));
    return value;
}

function fisUnit(value: unknown): FisUnit {
    if (value === 1 || value === 2) return value;
    throw new Error("FIS outbox payload contains an invalid FIS number");
}

function requiredString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    throw new Error(`FIS outbox payload is missing ${key}`);
}

export function decodeFisOutboxPayload(
    operation: FisOutboxOperation,
    rawPayload: unknown,
): FisOutboxPayload {
    const payload = parseJsonValue(rawPayload);
    if (!isRecord(payload)) throw new Error("FIS outbox payload must be a JSON object");

    const fis = fisUnit(payload.fis);
    if (operation === "DELETE") {
        return {fis, pallet_id: requiredString(payload, "pallet_id")};
    }

    if (!isRecord(payload.details)) {
        throw new Error("FIS outbox payload is missing details");
    }
    const details: FisUnitDetails = {
        pallet_id: requiredString(payload.details, "pallet_id"),
        project: requiredString(payload.details, "project"),
        model: requiredString(payload.details, "model"),
    };
    const result: SyncPayload = {
        fis,
        details,
        operator: requiredString(payload, "operator"),
        ...(payload.only_if_missing === true ? {only_if_missing: true} : {}),
    };

    if (operation === "MIGRATE") {
        return {...result, previous_fis: fisUnit(payload.previous_fis)};
    }
    return result;
}
