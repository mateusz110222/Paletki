
export type PalletStatus =
    | 'Active'
    | 'Washing_Required'
    | 'Damaged'
    | 'Blocked';

export const PALLET_STATUSES: PalletStatus[] = [
    'Active',
    'Washing_Required',
    'Damaged',
    'Blocked',
];

export interface AuditLog {
    id: number;
    pallet_id: string;
    timestamp: Date | string;
    operator_id: string;
    previous_status: PalletStatus | 'NEW' | string;
    new_status: PalletStatus | string;
    description: string;
}

export interface Pallet {
    id: number;
    pallet_id: string;
    project: string;
    model: string;
    max_cycles: number;
    current_cycles: number;
    total_cycles: number;
    nests: number;
    status: PalletStatus | null;
    block_reason?: string | null;
    fis?: number | null;
    created_at: Date | string;
    created_by: string;
    updated_at: Date | string;
    history?: AuditLog[];
}

export interface Project {
    name: string;
}

export type UserRole = 'staff' | 'operator';

export interface UserData {
    FullName: string;
    department: string;
    title: string;
    username: string;
    role: UserRole;
    has_it_department_access: boolean;
    is_guest: boolean;
}

export interface LoginResponse {
    status: boolean;
    message: string;
    data?: UserData;
    token?: string;
    expires_at?: string;
}
