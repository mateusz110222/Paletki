import type {UserData} from '@backend/shared/types';

export interface StoredSession {
    user: UserData;
    token: string;
    expiresAt: string;
}

export function parseStoredSession(value: string | null, now = Date.now()): StoredSession | null {
    if (!value) return null;

    try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed !== 'object' || parsed === null) return null;

        const expiresAt = (
            'expiresAt' in parsed && typeof parsed.expiresAt === 'string'
        ) ? Date.parse(parsed.expiresAt) : Number.NaN;
        if (
            !('user' in parsed) ||
            typeof parsed.user !== 'object' ||
            parsed.user === null ||
            !('FullName' in parsed.user) ||
            typeof parsed.user.FullName !== 'string' ||
            !('username' in parsed.user) ||
            typeof parsed.user.username !== 'string' ||
            !('role' in parsed.user) ||
            (parsed.user.role !== 'staff' && parsed.user.role !== 'operator') ||
            !('has_it_department_access' in parsed.user) ||
            typeof parsed.user.has_it_department_access !== 'boolean' ||
            !('has_ur_department_access' in parsed.user) ||
            typeof parsed.user.has_ur_department_access !== 'boolean' ||
            !('has_me_department_access' in parsed.user) ||
            typeof parsed.user.has_me_department_access !== 'boolean' ||
            !('is_guest' in parsed.user) ||
            typeof parsed.user.is_guest !== 'boolean' ||
            !('token' in parsed) ||
            typeof parsed.token !== 'string' ||
            parsed.token.length === 0 ||
            !Number.isFinite(expiresAt) ||
            expiresAt <= now
        ) {
            return null;
        }

        return parsed as StoredSession;
    } catch {
        return null;
    }
}
