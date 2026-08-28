export interface AuthData {
    userID: string;
    fullName: string;
    department: string;
    title: string;
    hasITDepartmentAccess: boolean;
    hasURDepartmentAccess: boolean;
    hasMEDepartmentAccess: boolean;
    sessionHash: string;
}
