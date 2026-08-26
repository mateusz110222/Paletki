import type {UserData} from '@backend/shared/types';

export function getViewAccess(user: Pick<UserData, 'has_it_department_access' | 'has_ur_department_access' | 'has_me_department_access'> | null) {
    const hasITDepartmentAccess = user?.has_it_department_access === true;
    const hasURDepartmentAccess = user?.has_ur_department_access === true;
    const hasMEDepartmentAccess = user?.has_me_department_access === true;
    const canManagePallets = hasITDepartmentAccess || hasMEDepartmentAccess;
    return {
        hasITDepartmentAccess,
        hasURDepartmentAccess,
        hasMEDepartmentAccess,
        canManagePallets,
        isMaintenanceOnly: hasURDepartmentAccess && !canManagePallets,
        canAccessMaintenance: canManagePallets || hasURDepartmentAccess,
        defaultPath: canManagePallets ? '/admin' : hasURDepartmentAccess ? '/maintenance' : '/operator',
    };
}
