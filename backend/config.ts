import dotenv from "dotenv";
import {resolve} from "node:path";
import {readFileSync} from "node:fs";
import * as tls from "node:tls";

const workingDirectory = process.cwd();
const initialDirectory = process.env.INIT_CWD;
const envPaths = [
    resolve(workingDirectory, ".env"),
    resolve(workingDirectory, "../.env"),
    ...(initialDirectory
        ? [resolve(initialDirectory, ".env"), resolve(initialDirectory, "../.env")]
        : []),
];

dotenv.config({
    path: envPaths,
    quiet: true,
});

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

function positiveIntegerEnv(name: string): number {
    const rawValue = requiredEnv(name);
    const value = Number(rawValue);

    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }

    return value;
}

function optionalPositiveIntegerEnv(name: string, defaultValue: number): number {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) return defaultValue;

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }

    return value;
}

function requiredListEnv(name: string): string[] {
    const values = requiredEnv(name)
        .split(";")
        .map((value) => value.trim())
        .filter(Boolean);

    if (values.length === 0) {
        throw new Error(`${name} must contain at least one value`);
    }

    return [...new Set(values)];
}

function booleanEnv(name: string): boolean {
    const value = requiredEnv(name).toLowerCase();

    if (value !== "true" && value !== "false") {
        throw new Error(`${name} must be either true or false`);
    }

    return value === "true";
}

function optionalFileEnv(name: string): Buffer | undefined {
    const path = process.env[name]?.trim();
    if (!path) return undefined;

    try {
        return readFileSync(resolve(path));
    } catch (error) {
        throw new Error(`Cannot read file configured by ${name}: ${path}`, {cause: error});
    }
}

function ldapCertificateAuthorities(): Array<string | Buffer> {
    const customCertificate = optionalFileEnv("LDAP_CA_CERT_PATH");
    const tlsWithSystemCertificates = tls as typeof tls & {
        getCACertificates?: (type: "system") => string[];
    };
    const systemCertificates = tlsWithSystemCertificates.getCACertificates?.("system") ?? [];

    return [
        ...tls.rootCertificates,
        ...systemCertificates,
        ...(customCertificate ? [customCertificate] : []),
    ];
}

function ldapUrlEnv(): string {
    const value = requiredEnv("LDAP_URL");
    let url: URL;

    try {
        url = new URL(value);
    } catch {
        throw new Error("LDAP_URL must be a valid LDAP URL");
    }

    if (url.protocol !== "ldap:" && url.protocol !== "ldaps:") {
        throw new Error("LDAP_URL must use ldap:// or ldaps://");
    }
    if (url.username || url.password || !["", "/"].includes(url.pathname) || url.search || url.hash) {
        throw new Error("LDAP_URL may only contain the protocol, host, and port");
    }

    return value;
}

const ldapUrl = ldapUrlEnv();
const ldapRejectUnauthorized = booleanEnv("LDAP_TLS_REJECT_UNAUTHORIZED");

if (process.env.ENCORE_ENV === "production") {
    if (!ldapUrl.toLowerCase().startsWith("ldaps://")) {
        throw new Error("Production LDAP_URL must use ldaps://");
    }
    if (!ldapRejectUnauthorized) {
        throw new Error("LDAP_TLS_REJECT_UNAUTHORIZED must be true in production");
    }
}

export const config = Object.freeze({
    auth: Object.freeze({
        sessionTtlMinutes: optionalPositiveIntegerEnv("AUTH_SESSION_TTL_MINUTES", 720),
    }),
    ldap: Object.freeze({
        url: ldapUrl,
        loginDomain: requiredEnv("LDAP_LOGIN_DOMAIN"),
        searchBase: requiredEnv("LDAP_SEARCH_BASE"),
        itDepartments: Object.freeze(requiredListEnv("LDAP_IT_DEPARTMENTS")),
        timeoutMs: positiveIntegerEnv("LDAP_TIMEOUT_MS"),
        connectTimeoutMs: positiveIntegerEnv("LDAP_CONNECT_TIMEOUT_MS"),
        rejectUnauthorized: ldapRejectUnauthorized,
        allowLegacyServerCertificate: booleanEnv("LDAP_TLS_ALLOW_LEGACY_SERVER_CERT"),
        ca: ldapCertificateAuthorities(),
    }),
    fis: Object.freeze({
        router1Url: requiredEnv("FIS1_ROUTER_URL"),
        router2Url: requiredEnv("FIS2_ROUTER_URL"),
        requestTimeoutMs: optionalPositiveIntegerEnv("FIS_REQUEST_TIMEOUT_MS", 10_000),
    }),
});
