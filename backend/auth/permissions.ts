import {PalletStatus} from "../shared/types";

const OPERATOR_ALLOWED_STATUSES: PalletStatus[] = ["Damaged", "Washing_Required", "Blocked"];

export function canChangePalletStatus(
    hasITDepartmentAccess: boolean,
    requestedStatus: PalletStatus,
    resetCycles: boolean,
): boolean {
    if (hasITDepartmentAccess) return true;
    return !resetCycles && OPERATOR_ALLOWED_STATUSES.includes(requestedStatus);
}

function normalizeDepartment(department: string): string {
    return department.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function hasITDepartmentAccess(department: string, allowedDepartments: readonly string[]): boolean {
    const normalizedDepartment = normalizeDepartment(department);
    return normalizedDepartment.length > 0 && allowedDepartments.some(
        (allowedDepartment) => normalizeDepartment(allowedDepartment) === normalizedDepartment,
    );
}
