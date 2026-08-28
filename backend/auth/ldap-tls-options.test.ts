import {describe, expect, it} from "vitest";
import {ldapCompatibilityTlsOptions} from "./ldap-tls-options";

describe("LDAP TLS compatibility options", () => {
    it("keeps strict hostname verification by default", () => {
        const options = ldapCompatibilityTlsOptions(false, false);
        expect(options.checkServerIdentity).toBeUndefined();
        expect(options.ciphers).toBeUndefined();
    });

    it("can skip only hostname matching for a trusted legacy LDAP certificate", () => {
        const options = ldapCompatibilityTlsOptions(false, true);
        expect(options.checkServerIdentity?.("ldap.internal", {} as never)).toBeUndefined();
        expect(options.ciphers).toBeUndefined();
    });
});
