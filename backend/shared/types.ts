
export type PalletStatus =
    | 'Active'
    | 'Washing_Required'
    | 'Damaged'
    | 'Blocked';

export const PALLET_STATUSES: readonly PalletStatus[] = [
    'Active',
    'Washing_Required',
    'Damaged',
    'Blocked',
];

export interface AuditLog {
    id: number;
    pallet_id: string;
    timestamp: string;
    operator_id: string;
    previous_status: PalletStatus | 'NEW';
    new_status: PalletStatus | 'DELETED';
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
    status: PalletStatus;
    block_reason?: string | null;
    fis: 1 | 2;
    created_at: string;
    created_by: string;
    updated_at: string;
}

export interface Project {
    name: string;
}

export interface PalletModel {
    name: string;
    project: string;
}

export interface PublicDashboardPallet {
    pallet_id: string;
    project: string;
    model: string;
    status: PalletStatus;
    current_cycles: number;
    max_cycles: number;
    status_changed_at: string;
}

export interface PublicDashboardServiceDay {
    day: string;
    completed: number;
    average_minutes: number;
}

export interface ProductionStation {
    station: string;
    pallet_id: string;
    project: string;
    model: string;
    updated_at: string;
}

export interface PublicDashboardResponse {
    generated_at: string;
    scope: 'selection' | 'all' | 'station';
    stations: ProductionStation[];
    selected_station: ProductionStation | null;
    pallets: PublicDashboardPallet[];
    service: {
        average_minutes_30d: number;
        completed_30d: number;
        daily: PublicDashboardServiceDay[];
    };
}

export type UserRole = 'staff' | 'operator';

export interface UserData {
    FullName: string;
    department: string;
    title: string;
    username: string;
    role: UserRole;
    has_it_department_access: boolean;
    has_ur_department_access: boolean;
    has_me_department_access: boolean;
    is_guest: boolean;
}

export interface LoginResponse {
    status: true;
    message: string;
    data: UserData;
    token: string;
    expires_at: string;
}

export interface DirectoryUser {
    net_id: string;
    full_name: string;
    department: string;
    title: string;
    groups: string[];
    groups_complete: boolean;
    has_it_department_access: boolean;
    has_ur_department_access: boolean;
    has_me_department_access: boolean;
}
