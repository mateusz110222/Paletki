import type {UserData} from '@backend/shared/types';
import {postBroadcastMessage, subscribeBroadcast} from '../lib/broadcastSync.ts';

export const AUTH_STORAGE_KEY = 'paletki_user_session_v2';

export interface StoredSession {
    user: UserData;
    token: string;
    expiresAt: string;
}

export function isSameSession(a: StoredSession | null, b: StoredSession | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
        a.token === b.token &&
        a.expiresAt === b.expiresAt &&
        a.user.username === b.user.username &&
        a.user.FullName === b.user.FullName &&
        a.user.role === b.user.role &&
        a.user.department === b.user.department &&
        a.user.title === b.user.title &&
        a.user.has_it_department_access === b.user.has_it_department_access &&
        a.user.has_ur_department_access === b.user.has_ur_department_access &&
        a.user.has_me_department_access === b.user.has_me_department_access &&
        a.user.is_guest === b.user.is_guest
    );
}

export function isCurrentSessionToken(token: string | undefined, currentToken: string | undefined): boolean {
    if (!token || token !== currentToken) return false;
    try {
        // Another tab may have saved a new session before its notification arrives.
        const stored = parseStoredSession(localStorage.getItem(AUTH_STORAGE_KEY));
        return !stored || stored.token === token;
    } catch {
        // The in-memory session remains authoritative when storage is unavailable.
        return true;
    }
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

export function loadStoredSession(options?: {broadcastOnExpire?: boolean; now?: number}): StoredSession | null {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return null;
        const parsed = parseStoredSession(raw, options?.now);
        if (!parsed) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            if (options?.broadcastOnExpire) {
                postBroadcastMessage({type: 'auth:logout'});
            }
            return null;
        }
        return parsed;
    } catch {
        try {
            localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }
        return null;
    }
}

export function subscribeStoredSession(listener: (session: StoredSession | null) => void): () => void {
    return subscribeBroadcast(message => {
        if (message.type !== 'auth:session' && message.type !== 'auth:logout') return;

        let session: StoredSession | null;
        try {
            // Queued notifications may be outdated. Read the latest shared state
            // without writing it back and generating another storage event.
            session = parseStoredSession(localStorage.getItem(AUTH_STORAGE_KEY));
        } catch {
            // BroadcastChannel can still synchronize memory when storage is blocked.
            session = message.type === 'auth:session'
                ? parseStoredSession(JSON.stringify(message.session))
                : null;
        }
        listener(session);
    });
}

export function saveStoredSession(
    session: StoredSession,
    options?: {broadcast?: boolean; now?: number},
): StoredSession | null {
    const validated = parseStoredSession(JSON.stringify(session), options?.now);
    if (!validated) return null;
    try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(validated));
    } catch {
        // Keep session active in memory when storage is unavailable
    }
    if (options?.broadcast !== false) {
        postBroadcastMessage({type: 'auth:session', session: validated});
    }
    return validated;
}

export function clearStoredSession(options?: {broadcast?: boolean}): void {
    try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
        // Ignore storage errors
    }
    if (options?.broadcast !== false) {
        postBroadcastMessage({type: 'auth:logout'});
    }
}
