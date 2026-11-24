import type {UserData} from '@backend/shared/types';

export function getViewAccess(user: Pick<UserData, 'has_it_department_access' | 'has_ur_department_access' | 'has_me_department_access' | 'has_lab_access'> | null) {
    const hasITDepartmentAccess = user?.has_it_department_access === true;
    const hasURDepartmentAccess = user?.has_ur_department_access === true;
    const hasMEDepartmentAccess = user?.has_me_department_access === true;
    const canManagePallets = hasITDepartmentAccess || hasMEDepartmentAccess;
    const canAccessLab = hasITDepartmentAccess || user?.has_lab_access === true;
    const canAccessMaintenance = canManagePallets || hasURDepartmentAccess;
    const accessGroups = [
        ...(canManagePallets ? ['ADMIN'] : []),
        ...(canAccessLab ? ['LAB'] : []),
        ...(canAccessMaintenance ? ['UR'] : []),
    ];
    if (user && accessGroups.length === 0) accessGroups.push('OPERATOR');
    return {
        hasITDepartmentAccess,
        hasURDepartmentAccess,
        hasMEDepartmentAccess,
        canManagePallets,
        isMaintenanceOnly: hasURDepartmentAccess && !canManagePallets,
        canAccessMaintenance,
        canAccessLab,
        accessGroups,
        defaultPath: canManagePallets ? '/admin' : hasURDepartmentAccess ? '/maintenance' : canAccessLab ? '/lab' : '/operator',
    };
}
