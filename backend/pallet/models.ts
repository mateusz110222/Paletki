import type {AuditLog, Pallet, PalletStatus} from "../shared/types";

export interface PalletRecord {
    id: number;
    pallet_id: string;
    project: string;
    model: string;
    max_cycles: number;
    current_cycles: number;
    total_cycles: number;
    nests: number;
    status: PalletStatus;
    block_reason: string | null;
    fis: 1 | 2;
    created_at: Date;
    created_by: string;
    updated_at: Date;
    updated_by: string | null;
    deleted_at: Date | null;
    deleted_by: string | null;
    last_operation_description: string | null;
}

export interface AuditLogRecord {
    id: number;
    pallet_id: string;
    timestamp: Date;
    operator_id: string;
    previous_status: PalletStatus | "NEW";
    new_status: PalletStatus | "DELETED";
    description: string;
}

export function toPalletDTO(row: PalletRecord): Pallet {
    return {
        id: row.id,
        pallet_id: row.pallet_id,
        project: row.project,
        model: row.model,
        max_cycles: row.max_cycles,
        current_cycles: row.current_cycles,
        total_cycles: row.total_cycles,
        nests: row.nests,
        status: row.status,
        block_reason: row.block_reason,
        fis: row.fis,
        created_at: row.created_at.toISOString(),
        created_by: row.created_by,
        updated_at: row.updated_at.toISOString(),
    };
}

export function toAuditLogDTO(row: AuditLogRecord): AuditLog {
    return {
        ...row,
        timestamp: row.timestamp.toISOString(),
    };
}
