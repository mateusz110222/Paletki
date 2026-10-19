import React, { createContext, ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoginResponse, UserData } from "@backend/shared/types";
import { useTranslation } from "../i18n/LanguageContext.tsx";
import { getViewAccess } from './view-access';
import { asLoginResponse, authenticatedApi, publicApi } from '../lib/api.ts';
import type Client from '../lib/client.ts';
import { getErrorMessage } from '../lib/errors.ts';
import {
    clearStoredSession,
    isSameSession,
    isCurrentSessionToken,
    loadStoredSession,
    saveStoredSession,
    subscribeStoredSession,
    type StoredSession,
} from './session.ts';

export type LoginResult = LoginResponse | { status: false; message: string };

interface AuthContextType {
    user: UserData | null;
    isAuthenticated: boolean;
    isGuest: boolean;
    hasITDepartmentAccess: boolean;
    hasURDepartmentAccess: boolean;
    hasMEDepartmentAccess: boolean;
    canManagePallets: boolean;
    isMaintenanceOnly: boolean;
    canAccessMaintenance: boolean;
    defaultPath: string;
    login: (username: string, password: string) => Promise<LoginResult>;
    loginAsOperator: (identifier: string) => Promise<LoginResult>;
    logout: () => Promise<void>;
    apiClient: Client;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const MAX_TIMEOUT_MS = 2_147_483_647;

function sessionFromResponse(response: LoginResult): StoredSession | null {
    if (!response.status) return null;
    const expiresAt = Date.parse(response.expires_at);
    if (!response.token || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return { user: response.data, token: response.token, expiresAt: response.expires_at };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { language, t } = useTranslation();
    const [session, setSession] = useState<StoredSession | null>(() =>
        loadStoredSession({ broadcastOnExpire: true }),
    );
    const sessionRef = useRef(session);
    const updateSession = useCallback((next: StoredSession | null) => {
        // Update immediately so already running requests see the latest session,
        // even before React commits the next render.
        sessionRef.current = next;
        setSession(prev => (isSameSession(prev, next) ? prev : next));
    }, []);

    useEffect(() => {
        return subscribeStoredSession((stored) => {
            updateSession(stored);
        });
    }, [updateSession]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

        const syncFromStorage = () => {
            const stored = loadStoredSession({ broadcastOnExpire: true });
            updateSession(stored);
        };

        const onVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                syncFromStorage();
            }
        };

        window.addEventListener('focus', syncFromStorage);
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('visibilitychange', onVisibilityChange);
        }
        return () => {
            window.removeEventListener('focus', syncFromStorage);
            if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
                document.removeEventListener('visibilitychange', onVisibilityChange);
            }
        };
    }, [updateSession]);

    useEffect(() => {
        if (!session || typeof window === 'undefined') return;

        const expiresAtMs = Date.parse(session.expiresAt);
        if (!Number.isFinite(expiresAtMs)) {
            clearStoredSession({ broadcast: true });
            updateSession(null);
            return;
        }

        const remainingMs = Math.max(0, expiresAtMs - Date.now());
        const expirationTimer = window.setTimeout(() => {
            if (Date.parse(session.expiresAt) <= Date.now()) {
                clearStoredSession({ broadcast: true });
                updateSession(null);
            }
        }, Math.min(remainingMs, MAX_TIMEOUT_MS));
        return () => window.clearTimeout(expirationTimer);
    }, [session, updateSession]);

    const applyLoginResponse = useCallback((response: LoginResult): LoginResult => {
        const nextSession = sessionFromResponse(response);
        if (!nextSession) return { status: false, message: response.message };
        saveStoredSession(nextSession, { broadcast: true });
        updateSession(nextSession);
        return response;
    }, [updateSession]);

    const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
        try {
            const responseData = asLoginResponse(await publicApi.auth.Login({
                login: username,
                password,
                acceptLanguage: language,
            }));
            return applyLoginResponse(responseData);
        } catch (error) {
            return { status: false, message: getErrorMessage(error, t("auth_error")) };
        }
    }, [applyLoginResponse, language, t]);

    const loginAsOperator = useCallback(async (identifier: string): Promise<LoginResult> => {
        try {
            const responseData = asLoginResponse(await publicApi.auth.OperatorSessionLogin({
                identifier,
                acceptLanguage: language,
            }));
            return applyLoginResponse(responseData);
        } catch (error) {
            return { status: false, message: getErrorMessage(error, t("auth_error")) };
        }
    }, [applyLoginResponse, language, t]);

    const logout = useCallback(async (): Promise<void> => {
        const token = session?.token;
        clearStoredSession({ broadcast: true });
        updateSession(null);
        if (!token) return;

        try {
            await authenticatedApi(token, language).auth.Logout({ acceptLanguage: language });
        } catch {
            // Local logout still succeeds if the backend is temporarily unavailable.
        }
    }, [language, session?.token, updateSession]);

    const handleUnauthorized = useCallback((token: string | undefined) => {
        if (!isCurrentSessionToken(token, sessionRef.current?.token)) return;
        clearStoredSession({ broadcast: true });
        updateSession(null);
    }, [updateSession]);

    const user = session?.user ?? null;
    const apiClient = useMemo(
        () => authenticatedApi(session?.token, language, () => handleUnauthorized(session?.token)),
        [handleUnauthorized, language, session?.token],
    );
    return (
        <AuthContext value={{
            user,
            isAuthenticated: session !== null,
            isGuest: user?.is_guest === true,
            ...getViewAccess(user),
            login,
            loginAsOperator,
            logout,
            apiClient,
        }}>
            {children}
        </AuthContext>
    );
};

export const useAuth = (): AuthContextType => {
    const context = use(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
