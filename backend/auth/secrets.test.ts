import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({encoreValue: ""}));

vi.mock("encore.dev/config", () => ({
    secret: () => () => mocks.encoreValue,
}));

import {ldapLookupBindPassword} from "./secrets";

const originalEnvironmentValue = process.env.LDAP_LOOKUP_BIND_PASSWORD;

beforeEach(() => {
    mocks.encoreValue = "";
    delete process.env.LDAP_LOOKUP_BIND_PASSWORD;
});

afterEach(() => {
    if (originalEnvironmentValue === undefined) {
        delete process.env.LDAP_LOOKUP_BIND_PASSWORD;
    } else {
        process.env.LDAP_LOOKUP_BIND_PASSWORD = originalEnvironmentValue;
    }
});

describe("LDAP lookup bind password", () => {
    it("prefers the Encore secret", () => {
        mocks.encoreValue = " encore-secret ";
        process.env.LDAP_LOOKUP_BIND_PASSWORD = "environment-secret";
        expect(ldapLookupBindPassword()).toBe("encore-secret");
    });

    it("uses the backend environment for an unlinked local app", () => {
        process.env.LDAP_LOOKUP_BIND_PASSWORD = " environment-secret ";
        expect(ldapLookupBindPassword()).toBe("environment-secret");
    });

    it("returns an empty value when neither source is configured", () => {
        expect(ldapLookupBindPassword()).toBe("");
    });
});
