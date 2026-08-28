import {secret} from "encore.dev/config";

const encoreLdapLookupBindPassword = secret(
    "LDAPLookupBindPassword",
);

export function ldapLookupBindPassword(): string {
    const encoreValue = encoreLdapLookupBindPassword().trim();
    if (encoreValue) return encoreValue;
    return process.env.LDAP_LOOKUP_BIND_PASSWORD?.trim() ?? "";
}
