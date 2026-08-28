import React, {createContext, ReactNode, use, useCallback, useEffect, useMemo, useState} from "react";
import {LoginResponse, UserData} from "@backend/shared/types";
import {useTranslation} from "../i18n/LanguageContext.tsx";
import {getViewAccess} from './view-access';
import {asLoginResponse, authenticatedApi, publicApi} from '../lib/api.ts';
import type Client from '../lib/client.ts';

interface StoredSession {
    user: UserData;
    token: string;
    expiresAt: string;
}

export type LoginResult = LoginResponse | {status: false; message: string};

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
const AUTH_STORAGE_KEY = "paletki_user_session";

function parseStoredSession(value: string | null): StoredSession | null {
    if (!value) return null;

    try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed !== "object" || parsed === null) return null;

        const expiresAt = (
            "expiresAt" in parsed && typeof parsed.expiresAt === "string"
        ) ? Date.parse(parsed.expiresAt) : Number.NaN;
        if (
            !("user" in parsed) ||
            typeof parsed.user !== "object" ||
            parsed.user === null ||
            !("FullName" in parsed.user) ||
            typeof parsed.user.FullName !== "string" ||
            !("username" in parsed.user) ||
            typeof parsed.user.username !== "string" ||
            !("role" in parsed.user) ||
            (parsed.user.role !== "staff" && parsed.user.role !== "operator") ||
            !("has_it_department_access" in parsed.user) ||
            typeof parsed.user.has_it_department_access !== "boolean" ||
            !("has_ur_department_access" in parsed.user) ||
            typeof parsed.user.has_ur_department_access !== "boolean" ||
            !("has_me_department_access" in parsed.user) ||
            typeof parsed.user.has_me_department_access !== "boolean" ||
            !("is_guest" in parsed.user) ||
            typeof parsed.user.is_guest !== "boolean" ||
            !("token" in parsed) ||
            typeof parsed.token !== "string" ||
            !Number.isFinite(expiresAt)
        ) {
            return null;
        }

        return parsed as StoredSession;
    } catch {
        return null;
    }
}

function sessionFromResponse(response: LoginResult): StoredSession | null {
    if (!response.status) return null;
    const expiresAt = Date.parse(response.expires_at);
    if (!response.token || !Number.isFinite(expiresAt)) return null;
    return {user: response.data, token: response.token, expiresAt: response.expires_at};
}

export const AuthProvider: React.FC<{children: ReactNode}> = ({children}) => {
    const {language, t} = useTranslation();
    const [session, setSession] = useState<StoredSession | null>(() => {
        const storedSession = parseStoredSession(localStorage.getItem(AUTH_STORAGE_KEY));
        if (!storedSession) localStorage.removeItem(AUTH_STORAGE_KEY);
        return storedSession;
    });

    useEffect(() => {
        if (!session) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            return;
        }

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        const remainingMs = Date.parse(session.expiresAt) - Date.now();
        // The backend is authoritative for session expiry. If the browser clock
        // is ahead of the server clock, wait for a protected request to return
        // 401 instead of immediately discarding a newly issued valid session.
        if (remainingMs <= 0) return;
        const expirationTimer = window.setTimeout(() => setSession(null), Math.max(0, remainingMs));
        return () => window.clearTimeout(expirationTimer);
    }, [session]);

    const applyLoginResponse = useCallback((response: LoginResult): LoginResult => {
        const nextSession = sessionFromResponse(response);
        if (!nextSession) return {status: false, message: response.message};
        setSession(nextSession);
        return response;
    }, []);

    const login = async (username: string, password: string): Promise<LoginResult> => {
        try {
            const responseData = asLoginResponse(await publicApi.auth.Login({
                login: username,
                password,
                acceptLanguage: language,
            }));
            return applyLoginResponse(responseData);
        } catch (error) {
            return {status: false, message: error instanceof Error ? error.message : t("auth_error")};
        }
    };

    const loginAsOperator = async (identifier: string): Promise<LoginResult> => {
        try {
            const responseData = asLoginResponse(await publicApi.auth.OperatorSessionLogin({
                identifier,
                acceptLanguage: language,
            }));
            return applyLoginResponse(responseData);
        } catch (error) {
            return {status: false, message: error instanceof Error ? error.message : t("auth_error")};
        }
    };

    const logout = async (): Promise<void> => {
        const token = session?.token;
        setSession(null);
        if (!token) return;

        try {
            await authenticatedApi(token, language).auth.Logout({acceptLanguage: language});
        } catch {
            // Local logout still succeeds if the backend is temporarily unavailable.
        }
    };

    const user = session?.user ?? null;
    const apiClient = useMemo(
        () => authenticatedApi(session?.token, language, () => setSession(null)),
        [language, session?.token],
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
