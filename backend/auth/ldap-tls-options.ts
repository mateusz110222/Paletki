import type {ConnectionOptions} from "node:tls";

type CompatibilityTlsOptions = Pick<ConnectionOptions, "ciphers" | "checkServerIdentity">;

export function ldapCompatibilityTlsOptions(
    allowLegacyServerCertificate: boolean,
    skipHostnameVerification: boolean,
): Partial<CompatibilityTlsOptions> {
    return {
        ...(allowLegacyServerCertificate ? {ciphers: "DEFAULT@SECLEVEL=1"} : {}),
        ...(skipHostnameVerification ? {checkServerIdentity: () => undefined} : {}),
    };
}
