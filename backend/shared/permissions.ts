import {PalletStatus} from "./types";

const OPERATOR_ALLOWED_STATUSES: PalletStatus[] = ["Damaged", "Washing_Required", "Blocked"];

export function canChangePalletStatus(
    hasITDepartmentAccess: boolean,
    requestedStatus: PalletStatus,
    resetCycles: boolean,
    hasURDepartmentAccess = false,
    hasMEDepartmentAccess = false,
): boolean {
    if (hasITDepartmentAccess || hasMEDepartmentAccess) return true;
    if (hasURDepartmentAccess) {
        return (requestedStatus === "Active" && resetCycles) ||
            (requestedStatus === "Damaged" && !resetCycles);
    }
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

export function departmentAccess(
    department: string,
    itDepartments: readonly string[],
    urDepartments: readonly string[],
    meDepartments: readonly string[] = [],
) {
    return {
        has_it_department_access: hasITDepartmentAccess(department, itDepartments),
        has_ur_department_access: hasITDepartmentAccess(department, urDepartments),
        has_me_department_access: hasITDepartmentAccess(department, meDepartments),
    };
}
