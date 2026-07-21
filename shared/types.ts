// shared/types.ts

export type PalletStatus =
    | 'Active'
    | 'Maintenance_Required'
    | 'Damaged'
    | 'Blocked'
    | 'In_Repair'
    | 'In_Washing';

export interface Pallet {
    id: number;
    pallet_id: string;
    project: string;
    max_cycles: number;
    current_cycles: number;
    current_unit_cycle: number;
    total_cycles: number;
    nests: number;
    status: PalletStatus | string;
    block_reason?: string | null;
    fis?: number | null;
    created_at: Date | string;
    created_by: string;
    updated_at: Date | string;
}