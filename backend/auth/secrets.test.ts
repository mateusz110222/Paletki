import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({encoreValue: ""}));

vi.mock("encore.dev/config", () => ({
    secret: () => () => mocks.encoreValue,
}));

import {apacsDbPassword, fisDbPassword, ldapLookupBindPassword} from "./secrets";

const originalEnvironmentValue = process.env.LDAP_LOOKUP_BIND_PASSWORD;
const originalFisPassword = process.env.FIS_DB_PASSWORD;
const originalApacsPassword = process.env.APACS_DB_PASSWORD;

beforeEach(() => {
    mocks.encoreValue = "";
    delete process.env.LDAP_LOOKUP_BIND_PASSWORD;
    delete process.env.FIS_DB_PASSWORD;
    delete process.env.APACS_DB_PASSWORD;
});

afterEach(() => {
    if (originalEnvironmentValue === undefined) {
        delete process.env.LDAP_LOOKUP_BIND_PASSWORD;
    } else {
        process.env.LDAP_LOOKUP_BIND_PASSWORD = originalEnvironmentValue;
    }
    if (originalFisPassword === undefined) delete process.env.FIS_DB_PASSWORD;
    else process.env.FIS_DB_PASSWORD = originalFisPassword;
    if (originalApacsPassword === undefined) delete process.env.APACS_DB_PASSWORD;
    else process.env.APACS_DB_PASSWORD = originalApacsPassword;
});

it("reads the APACS password from Encore first, preserving whitespace in credentials", () => {
    process.env.APACS_DB_PASSWORD = ' env-secret ';
    expect(apacsDbPassword()).toBe(' env-secret ');
    mocks.encoreValue = ' encore-secret ';
    expect(apacsDbPassword()).toBe(' encore-secret ');
});

it("reads the FIS database password from the backend environment", () => {
    process.env.FIS_DB_PASSWORD = "fis-secret";
    expect(fisDbPassword()).toBe("fis-secret");
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
