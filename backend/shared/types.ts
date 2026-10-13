
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
    event_kind?: "unblock" | "status" | "update";
    comment?: string;
    id: number;
    pallet_id: string;
    timestamp: string;
    operator_id: string;
    previous_status: PalletStatus | 'NEW';
    new_status: PalletStatus | 'DELETED';
    description: string;
}

export type PalletMachine = "WSM" | "SSM" | "COAT";

export interface Defect { id: number; name: string; }

export interface OperatorReport {
    kind: "defect" | "washing";
    id: number; pallet_id: string; audit_log_id: number;
    defect_id: number | null; defect_name: string; description: string;
    operator_id: string; created_at: string; closed_at: string | null;
    version: number; edited_by: string | null; edited_at: string | null;
}

export interface Pallet {
    machine: PalletMachine;
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
    id: number;
    name: string;
}

export interface PalletModel {
    id: number;
    project_id: number;
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
    station_history: ProductionStation[];
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
    fis_groups: string[];
    has_it_department_access: boolean;
    has_ur_department_access: boolean;
    has_me_department_access: boolean;
}

export interface ReportRow {
    id: number; pallet_id: string; project: string; model: string; machine: PalletMachine;
    previous_status: string | null; status: string; timestamp: string;
    defect: string | null; description: string; operator: string;
}
