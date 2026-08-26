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
    lookupLdapUser,
} from "./ldap";

function mockClient(searchEntries: Array<Record<string, string | string[]>> = []): LdapClient {
    return {
        bind: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue({searchEntries, searchReferences: []}),
        unbind: vi.fn().mockResolvedValue(undefined),
    } as unknown as LdapClient;
}

describe('directory lookup', () => {
    it('looks up an exact NetID and returns department and deduplicated direct groups', async () => {
        const client = mockClient([{dn: 'CN=Test', sAMAccountName: 'test', displayName: 'Test User',
            department: 'UR', title: 'Technician', memberOf: ['CN=B,DC=test', 'CN=A,DC=test', 'CN=A,DC=test']}]);
        expect(await lookupLdapUser(client, 'test', 'DC=test', 3000)).toEqual({
            net_id: 'test', full_name: 'Test User', department: 'UR', title: 'Technician',
            groups: ['CN=A,DC=test', 'CN=B,DC=test'], groups_complete: true,
        });
        expect(client.search).toHaveBeenCalledWith('DC=test', expect.objectContaining({
            filter: '(&(objectCategory=person)(objectClass=user)(sAMAccountName=test))', sizeLimit: 2, timeLimit: 3,
        }));
    });

    it.each(['*', 'a)(sAMAccountName=*)', 'test@example.com', 'DOMAIN\\test', '', 'a'.repeat(65)])('rejects invalid or wildcard NetID %s before search', async netId => {
        const client = mockClient();
        await expect(lookupLdapUser(client, netId, 'DC=test', 1000)).rejects.toBeInstanceOf(InvalidLdapLoginError);
        expect(client.search).not.toHaveBeenCalled();
    });

    it('handles scalar groups and reports ranged results honestly', async () => {
        expect((await lookupLdapUser(mockClient([{dn: 'CN=Test', memberOf: 'CN=A,DC=test'}]), 'test', 'DC=test', 1000)).groups).toEqual(['CN=A,DC=test']);
        expect((await lookupLdapUser(mockClient([{dn: 'CN=Test', 'memberOf;range=0-1499': ['CN=A,DC=test']}]), 'test', 'DC=test', 1000)).groups_complete).toBe(false);
        expect((await lookupLdapUser(mockClient([{dn: 'CN=Test', 'memberOf;range=0-*': ['CN=A,DC=test']}]), 'test', 'DC=test', 1000)).groups_complete).toBe(true);
    });

    it('handles missing groups, unknown users and ambiguous results', async () => {
        const result = await lookupLdapUser(mockClient([{dn: 'CN=Test'}]), 'test', 'DC=test', 1000);
        expect(result.groups).toEqual([]);
        expect(result.full_name).toBe('test');
        await expect(lookupLdapUser(mockClient(), 'test', 'DC=test', 1000)).rejects.toBeInstanceOf(LdapProfileNotFoundError);
        await expect(lookupLdapUser(mockClient([{dn: 'a'}, {dn: 'b'}]), 'test', 'DC=test', 1000)).rejects.toBeInstanceOf(LdapProfileAmbiguousError);
    });
});

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
