import {describe, expect, it, vi} from "vitest";
import {InvalidCredentialsError, SizeLimitExceededError, TimeLimitExceededError, UnavailableError} from "ldapts";
import {
    authenticateLdapUser,
    buildUserSearchFilter,
    classifyLdapError,
    InvalidLdapLoginError,
    LdapClient,
    LdapProfileAmbiguousError,
    LdapProfileNotFoundError,
    parseLdapLogin,
    withLdapClient,
} from "./ldap";

function mockClient(searchEntries: Array<Record<string, string | string[]>> = []): LdapClient {
    return {
        bind: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue({searchEntries, searchReferences: []}),
        unbind: vi.fn().mockResolvedValue(undefined),
    } as unknown as LdapClient;
}

describe("LDAP login parsing", () => {
    it("escapes every RFC 4515 special character", () => {
        expect(buildUserSearchFilter(
            {accountName: "a*)(b\\c\0", bindUser: "a*)(b\\c\0@example.com"},
            "a*)(b\\c\0",
        )).toContain("sAMAccountName=a\\2a\\29\\28b\\5cc\\00");
    });

    it.each([
        ["operator", {accountName: "operator", bindUser: "operator@example.com"}],
        ["operator@example.com", {accountName: "operator", bindUser: "operator@example.com"}],
        ["DOMAIN\\operator", {accountName: "operator", bindUser: "DOMAIN\\operator"}],
    ])("normalizes %s", (login, expected) => {
        expect(parseLdapLogin(login, "example.com")).toEqual(expected);
    });

    it.each([
        "",
        "operator name",
        "DOMAIN\\operator@example.com",
        "DOMAIN\\",
        "@example.com",
        `${"a".repeat(257)}`,
    ])("rejects invalid login %j", (login) => {
        expect(() => parseLdapLogin(login, "example.com")).toThrow(InvalidLdapLoginError);
    });

    it("escapes filter values and limits the search to AD users", () => {
        const identity = {accountName: "a*)(b", bindUser: "a*)(b@example.com"};
        const filter = buildUserSearchFilter(identity, "a*)(b");

        expect(filter).toBe(
            "(&(objectCategory=person)(objectClass=user)(|(userPrincipalName=a\\2a\\29\\28b@example.com)(sAMAccountName=a\\2a\\29\\28b)(mail=a\\2a\\29\\28b)))",
        );
    });
});

describe("LDAP authentication", () => {
    const identity = {accountName: "operator", bindUser: "operator@example.com"};

    it("returns a canonical directory profile and bounded search options", async () => {
        const client = mockClient([{
            dn: "CN=Operator,DC=example,DC=com",
            displayName: "Test Operator",
            department: "Production",
            title: "Operator",
            userPrincipalName: "canonical.operator@example.com",
            sAMAccountName: "canonical.operator",
        }]);

        await expect(authenticateLdapUser(
            client, identity, "operator", "secret", "DC=example,DC=com", 5000,
        )).resolves.toEqual({
            fullName: "Test Operator",
            department: "Production",
            title: "Operator",
            username: "canonical.operator@example.com",
        });

        expect(client.bind).toHaveBeenCalledWith(identity.bindUser, "secret");
        expect(client.search).toHaveBeenCalledWith("DC=example,DC=com", expect.objectContaining({
            sizeLimit: 2,
            timeLimit: 5,
            attributes: expect.not.arrayContaining(["mail", "givenName", "sn"]),
        }));
    });

    it("rejects a missing directory profile", async () => {
        await expect(authenticateLdapUser(
            mockClient(), identity, "operator", "secret", "DC=example,DC=com", 5000,
        )).rejects.toBeInstanceOf(LdapProfileNotFoundError);
    });

    it("rejects ambiguous directory profiles", async () => {
        await expect(authenticateLdapUser(
            mockClient([{dn: "one"}, {dn: "two"}]),
            identity,
            "operator",
            "secret",
            "DC=example,DC=com",
            5000,
        )).rejects.toBeInstanceOf(LdapProfileAmbiguousError);
    });

    it("does not replace a successful result when unbind fails", async () => {
        const client = mockClient();
        vi.mocked(client.unbind).mockRejectedValue(new Error("connection already closed"));

        await expect(withLdapClient(client, async () => "success")).resolves.toBe("success");
    });

    it("does not replace the original error when unbind fails", async () => {
        const client = mockClient();
        const originalError = new Error("bind failed");
        vi.mocked(client.unbind).mockRejectedValue(new Error("connection already closed"));

        await expect(withLdapClient(client, async () => {
            throw originalError;
        })).rejects.toBe(originalError);
    });
});

describe("LDAP error classification", () => {
    it("uses ldapts error types", () => {
        expect(classifyLdapError(new InvalidCredentialsError())).toBe("invalid_credentials");
        expect(classifyLdapError(new TimeLimitExceededError())).toBe("timeout");
        expect(classifyLdapError(new UnavailableError())).toBe("unavailable");
        expect(classifyLdapError(new SizeLimitExceededError())).toBe("profile");
    });

    it("recognizes network errors by their stable error code", () => {
        expect(classifyLdapError(Object.assign(new Error("socket"), {code: "ETIMEDOUT"}))).toBe("timeout");
        expect(classifyLdapError(Object.assign(new Error("socket"), {code: "ECONNREFUSED"}))).toBe("unavailable");
    });
});
