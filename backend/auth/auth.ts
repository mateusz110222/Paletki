import {api, APIError, Gateway, Header} from "encore.dev/api";
import {authHandler} from "encore.dev/auth";
import {SQLDatabase} from "encore.dev/storage/sqldb";
import {getAuthData} from "~encore/auth";
import {Client} from "ldapts";
import {randomUUID} from "node:crypto";
import {LoginResponse, UserData} from "../shared/types";
import {t} from "../pallet/i18n";
import {config} from "../config";
import {
    authenticateLdapUser,
    classifyLdapError,
    InvalidLdapLoginError,
    parseLdapLogin,
    withLdapClient,
} from "./ldap";
import type {LdapUserProfile} from "./ldap";
import {createSessionToken, extractBearerToken, hashSessionToken} from "./session-token";
import {hasITDepartmentAccess} from "./permissions";

const db = SQLDatabase.named("pallets");

interface LoginRequest {
    login: string;
    password: string;
    acceptLanguage?: Header<"Accept-Language">;
}

interface LocalizedRequest {
    acceptLanguage?: Header<"Accept-Language">;
}

interface AuthParams extends LocalizedRequest {
    authorization?: Header<"Authorization">;
}

interface SessionRow {
    username: string;
    full_name: string;
    department: string;
    title: string;
    expires_at: Date;
}

export interface AuthData {
    userID: string;
    fullName: string;
    department: string;
    title: string;
    hasITDepartmentAccess: boolean;
    sessionHash: string;
}

interface CreatedSession {
    token: string;
    expiresAt: Date;
}

async function createSession(user: UserData): Promise<CreatedSession> {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + config.auth.sessionTtlMinutes * 60_000);

    await db.exec`DELETE FROM auth_sessions WHERE expires_at <= NOW()`;
    await db.exec`
        INSERT INTO auth_sessions (
            token_hash, username, full_name, department, title, role, expires_at
        ) VALUES (
            ${tokenHash}::text, ${user.username}, ${user.FullName}, ${user.department}, ${user.title},
            ${user.role}, ${expiresAt}
        )
    `;

    return {token, expiresAt};
}

function loginResponse(message: string, user: UserData, session: CreatedSession): LoginResponse {
    return {
        status: true,
        message,
        data: user,
        token: session.token,
        expires_at: session.expiresAt.toISOString(),
    };
}

export const authentication = authHandler<AuthParams, AuthData>(async (params) => {
    const token = extractBearerToken(params.authorization);
    if (!token) throw APIError.unauthenticated(t("auth_session_invalid", params.acceptLanguage));

    const sessionHash = hashSessionToken(token);
    const session = await db.queryRow<SessionRow>`
        SELECT username, full_name, department, title, expires_at
        FROM auth_sessions
        WHERE token_hash::text = ${sessionHash}
          AND expires_at > NOW()
    `;

    if (!session) throw APIError.unauthenticated(t("auth_session_invalid", params.acceptLanguage));

    return {
        userID: session.username,
        fullName: session.full_name,
        department: session.department,
        title: session.title,
        hasITDepartmentAccess: hasITDepartmentAccess(session.department, config.ldap.itDepartments),
        sessionHash,
    };
});

export const gateway = new Gateway({authHandler: authentication});

export const Login = api(
    {method: "POST", path: "/auth/login", expose: true, sensitive: true},
    async (params: LoginRequest): Promise<LoginResponse> => {
        const lang = params.acceptLanguage;
        const normalizedLogin = params.login?.trim();
        const password = params.password;

        if (!normalizedLogin || !password) {
            throw APIError.invalidArgument(t("login_password_required", lang));
        }

        let identity;
        try {
            identity = parseLdapLogin(normalizedLogin, config.ldap.loginDomain);
        } catch (error) {
            if (error instanceof InvalidLdapLoginError) {
                throw APIError.invalidArgument(t("auth_invalid_login_format", lang));
            }
            throw error;
        }

        const client = new Client({
            url: config.ldap.url,
            tlsOptions: {
                rejectUnauthorized: config.ldap.rejectUnauthorized,
                ...(config.ldap.ca ? {ca: config.ldap.ca} : {}),
                ...(config.ldap.allowLegacyServerCertificate ? {ciphers: "DEFAULT@SECLEVEL=1"} : {}),
            },
            timeout: config.ldap.timeoutMs,
            connectTimeout: config.ldap.connectTimeoutMs,
        });

        let userData: LdapUserProfile;
        try {
            userData = await withLdapClient(client, () => authenticateLdapUser(
                client,
                identity,
                normalizedLogin,
                password,
                config.ldap.searchBase,
                config.ldap.timeoutMs,
            ));
        } catch (error) {
            const errorKind = classifyLdapError(error);

            if (errorKind === "invalid_credentials") {
                throw APIError.unauthenticated(t("auth_invalid_credentials", lang));
            }
            if (errorKind === "timeout") {
                throw APIError.unavailable(t("auth_timeout", lang));
            }
            if (errorKind === "unavailable") {
                throw APIError.unavailable(t("auth_unavailable", lang));
            }
            if (errorKind === "profile") {
                throw APIError.internal(t("auth_profile_error", lang), error as Error);
            }
            if (error instanceof APIError) throw error;

            const cause = error instanceof Error ? error : new Error(String(error));
            throw APIError.internal(t("auth_error", lang), cause);
        }

        const hasDepartmentAccess = hasITDepartmentAccess(userData.department, config.ldap.itDepartments);
        const user: UserData = {
            FullName: userData.fullName,
            department: userData.department,
            title: userData.title,
            username: userData.username,
            role: hasDepartmentAccess ? "staff" : "operator",
            has_it_department_access: hasDepartmentAccess,
            is_guest: false,
        };

        return loginResponse(t("auth_success", lang), user, await createSession(user));
    },
);

export const GuestLogin = api(
    {method: "POST", path: "/auth/guest", expose: true, sensitive: true},
    async (params: LocalizedRequest): Promise<LoginResponse> => {
        const user: UserData = {
            FullName: "Guest",
            department: "",
            title: "Operator",
            username: `guest-${randomUUID()}`,
            role: "operator",
            has_it_department_access: false,
            is_guest: true,
        };

        return loginResponse(
            t("auth_guest_success", params.acceptLanguage),
            user,
            await createSession(user),
        );
    },
);

export const Logout = api(
    {method: "POST", path: "/auth/logout", expose: true, auth: true},
    async (params: LocalizedRequest): Promise<{message: string}> => {
        const auth = getAuthData();
        if (!auth) throw APIError.unauthenticated(t("auth_session_invalid", params.acceptLanguage));

        await db.exec`DELETE FROM auth_sessions WHERE token_hash::text = ${auth.sessionHash}`;
        return {message: t("auth_logout_success", params.acceptLanguage)};
    },
);
