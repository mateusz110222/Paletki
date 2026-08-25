import {
    InvalidCredentialsError,
    SizeLimitExceededError,
    TimeLimitExceededError,
    UnavailableError,
} from "ldapts";
import type {Client, Entry} from "ldapts";

const MAX_LOGIN_LENGTH = 256;

export interface LdapIdentity {
    accountName: string;
    bindUser: string;
}

export interface LdapUserProfile {
    fullName: string;
    department: string;
    title: string;
    username: string;
}

export type LdapClient = Pick<Client, "bind" | "search" | "unbind">;

export type InvalidLdapLoginReason = "invalid_format" | "mixed_formats" | "invalid_domain_login" | "invalid_upn";

export class InvalidLdapLoginError extends Error {
    constructor(readonly reason: InvalidLdapLoginReason) {
        super();
    }
}
export class LdapProfileNotFoundError extends Error {}
export class LdapProfileAmbiguousError extends Error {}

export function escapeLdapFilterValue(value: string): string {
    return value.replace(/[\\*()\0]/g, (character) => {
        switch (character) {
            case "\\":
                return "\\5c";
            case "*":
                return "\\2a";
            case "(":
                return "\\28";
            case ")":
                return "\\29";
            case "\0":
                return "\\00";
            default:
                return character;
        }
    });
}

export function parseLdapLogin(login: string, loginDomain: string): LdapIdentity {
    const normalizedLogin = login.trim();
    const containsControlOrWhitespace = [...normalizedLogin].some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 32 || codePoint === 127;
    });

    if (
        !normalizedLogin ||
        normalizedLogin.length > MAX_LOGIN_LENGTH ||
        containsControlOrWhitespace
    ) {
        throw new InvalidLdapLoginError("invalid_format");
    }

    const hasDomainSeparator = normalizedLogin.includes("\\");
    const hasUpnSeparator = normalizedLogin.includes("@");
    if (hasDomainSeparator && hasUpnSeparator) {
        throw new InvalidLdapLoginError("mixed_formats");
    }

    if (hasDomainSeparator) {
        const parts = normalizedLogin.split("\\");
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new InvalidLdapLoginError("invalid_domain_login");
        }
        return {accountName: parts[1], bindUser: normalizedLogin};
    }

    if (hasUpnSeparator) {
        const parts = normalizedLogin.split("@");
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new InvalidLdapLoginError("invalid_upn");
        }
        return {accountName: parts[0], bindUser: normalizedLogin};
    }

    return {
        accountName: normalizedLogin,
        bindUser: `${normalizedLogin}@${loginDomain}`,
    };
}

export function buildUserSearchFilter(identity: LdapIdentity, originalLogin: string): string {
    const accountName = escapeLdapFilterValue(identity.accountName);
    const bindUser = escapeLdapFilterValue(identity.bindUser);
    const login = escapeLdapFilterValue(originalLogin.trim());

    return `(&(objectCategory=person)(objectClass=user)(|(userPrincipalName=${bindUser})(sAMAccountName=${accountName})(mail=${login})))`;
}

function attributeValue(entry: Entry, name: string): string {
    const value = entry[name];
    if (Array.isArray(value)) return value[0]?.toString() ?? "";
    return value?.toString() ?? "";
}

export async function authenticateLdapUser(
    client: LdapClient,
    identity: LdapIdentity,
    originalLogin: string,
    password: string,
    searchBase: string,
    timeoutMs: number,
): Promise<LdapUserProfile> {
    await client.bind(identity.bindUser, password);

    const {searchEntries} = await client.search(searchBase, {
        scope: "sub",
        filter: buildUserSearchFilter(identity, originalLogin),
        attributes: [
            "displayName",
            "title",
            "department",
            "cn",
            "userPrincipalName",
            "sAMAccountName",
        ],
        sizeLimit: 2,
        timeLimit: Math.max(1, Math.ceil(timeoutMs / 1000)),
    });

    if (searchEntries.length === 0) {
        throw new LdapProfileNotFoundError();
    }
    if (searchEntries.length > 1) {
        throw new LdapProfileAmbiguousError();
    }

    const userData = searchEntries[0];
    return {
        fullName: attributeValue(userData, "displayName") || attributeValue(userData, "cn") || identity.bindUser,
        department: attributeValue(userData, "department"),
        title: attributeValue(userData, "title"),
        username: attributeValue(userData, "userPrincipalName") ||
            attributeValue(userData, "sAMAccountName") ||
            identity.bindUser,
    };
}

export async function withLdapClient<T>(client: LdapClient, operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } finally {
        try {
            await client.unbind();
        } catch {
            // Cleanup must not replace the authentication result or the original LDAP error.
        }
    }
}

export type LdapErrorKind = "invalid_credentials" | "timeout" | "unavailable" | "profile" | "unknown";

export function classifyLdapError(error: unknown): LdapErrorKind {
    if (error instanceof InvalidCredentialsError) return "invalid_credentials";
    if (error instanceof TimeLimitExceededError) return "timeout";
    if (error instanceof UnavailableError) return "unavailable";
    if (
        error instanceof LdapProfileNotFoundError ||
        error instanceof LdapProfileAmbiguousError ||
        error instanceof SizeLimitExceededError
    ) return "profile";

    const code = error instanceof Error && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : "";

    if (code === "ETIMEDOUT") return "timeout";
    if (["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) {
        return "unavailable";
    }

    return "unknown";
}
