import {secret} from "encore.dev/config";

const encoreLdapLookupBindPassword = secret(
    "LDAPLookupBindPassword",
);
const encoreFisDbPassword = secret("FISDBPassword");

export function ldapLookupBindPassword(): string {
    const encoreValue = encoreLdapLookupBindPassword().trim();
    if (encoreValue) return encoreValue;
    return process.env.LDAP_LOOKUP_BIND_PASSWORD?.trim() ?? "";
}

export function fisDbPassword(): string {
    const encoreValue = encoreFisDbPassword();
    return encoreValue || process.env.FIS_DB_PASSWORD || "";
}
