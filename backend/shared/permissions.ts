import {PalletStatus} from "./types";

const OPERATOR_ALLOWED_STATUSES: PalletStatus[] = ["Damaged", "Washing_Required"];
export const OPERATOR_OTHER_FAULT_STATUS: PalletStatus = "Damaged";

export function canOpenPalletInOperatorPanel(status: PalletStatus): boolean {
    return status !== "Blocked";
}

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

export function fisGroupAccess(groups: readonly string[], itGroups: readonly string[], urGroup: string, meGroup: string) {
    const hasITAccess = itGroups.some(group => groups.includes(group));
    return {
        has_it_department_access: hasITAccess,
        has_ur_department_access: hasITAccess || groups.includes(urGroup),
        has_me_department_access: groups.includes(meGroup),
    };
}
