import React, {createContext, ReactNode, use, useCallback, useEffect, useState} from "react";
import {LoginResponse, UserData} from "@backend/shared/types";
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";
import {useTranslation} from "../i18n/LanguageContext.tsx";

interface StoredSession {
    user: UserData;
    token: string;
    expiresAt: string;
}

interface AuthContextType {
    user: UserData | null;
    isAuthenticated: boolean;
    isGuest: boolean;
    hasITDepartmentAccess: boolean;
    login: (username: string, password: string) => Promise<LoginResponse>;
    loginAsGuest: () => Promise<LoginResponse>;
    logout: () => Promise<void>;
    authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = "paletki_user_session";

function parseStoredSession(value: string | null): StoredSession | null {
    if (!value) return null;

    try {
        const parsed: unknown = JSON.parse(value);
        if (
            typeof parsed !== "object" ||
            parsed === null ||
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
            !("is_guest" in parsed.user) ||
            typeof parsed.user.is_guest !== "boolean" ||
            !("token" in parsed) ||
            typeof parsed.token !== "string" ||
            !("expiresAt" in parsed) ||
            typeof parsed.expiresAt !== "string" ||
            Date.parse(parsed.expiresAt) <= Date.now()
        ) {
            return null;
        }

        return parsed as StoredSession;
    } catch {
        return null;
    }
}

function sessionFromResponse(response: LoginResponse): StoredSession | null {
    if (!response.status || !response.data || !response.token || !response.expires_at) return null;
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
        const expirationTimer = window.setTimeout(() => setSession(null), Math.max(0, remainingMs));
        return () => window.clearTimeout(expirationTimer);
    }, [session]);

    const applyLoginResponse = useCallback((response: LoginResponse): LoginResponse => {
        const nextSession = sessionFromResponse(response);
        if (!nextSession) return {status: false, message: response.message};
        setSession(nextSession);
        return response;
    }, []);

    const login = async (username: string, password: string): Promise<LoginResponse> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept-Language": language},
                body: JSON.stringify({login: username, password}),
            });
            const responseData = await response.json() as LoginResponse;
            if (!response.ok) return {status: false, message: responseData.message};
            return applyLoginResponse(responseData);
        } catch {
            return {status: false, message: t("auth_error")};
        }
    };

    const loginAsGuest = async (): Promise<LoginResponse> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/guest`, {
                method: "POST",
                headers: {"Accept-Language": language},
            });
            const responseData = await response.json() as LoginResponse;
            if (!response.ok) return {status: false, message: responseData.message};
            return applyLoginResponse(responseData);
        } catch {
            return {status: false, message: t("auth_error")};
        }
    };

    const authenticatedFetch = useCallback(async (
        input: RequestInfo | URL,
        init: RequestInit = {},
    ): Promise<Response> => {
        const headers = new Headers(init.headers);
        if (session?.token) headers.set("Authorization", `Bearer ${session.token}`);

        const response = await fetch(input, {...init, headers});
        if (response.status === 401) setSession(null);
        return response;
    }, [session?.token]);

    const logout = async (): Promise<void> => {
        const token = session?.token;
        setSession(null);
        if (!token) return;

        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept-Language": language,
                },
            });
        } catch {
            // Local logout still succeeds if the backend is temporarily unavailable.
        }
    };

    const user = session?.user ?? null;
    return (
        <AuthContext value={{
            user,
            isAuthenticated: session !== null,
            isGuest: user?.is_guest === true,
            hasITDepartmentAccess: user?.has_it_department_access === true,
            login,
            loginAsGuest,
            logout,
            authenticatedFetch,
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
