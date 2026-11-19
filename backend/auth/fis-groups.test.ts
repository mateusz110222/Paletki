import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../config", () => ({
    config: {
        fis: {
            router1Url: "http://10.142.11.20/custom/matz/phpBB/router.php",
            requestTimeoutMs: 5000,
        },
    },
}));

import {clearFisGroupsCache, fisNetId, getFisGroups} from "./fis-groups";

const fetchMock = vi.fn();

beforeEach(() => {
    clearFisGroupsCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("FIS group lookup via router GetUserGroup", () => {
    it("normalizes an LDAP UPN to the FIS NetID", () => {
        expect(fisNetId("DOMAIN\\Alice@example.com")).toBe("Alice");
    });

    it("rejects unsafe identifiers before querying FIS", async () => {
        await expect(getFisGroups("bad user@example.com")).rejects.toThrow("Invalid FIS user identifier");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("queries router.php?job=GetUserGroup, filters unsafe group names and deduplicates", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                status: true,
                message: "User group loaded",
                data: ["admin_group", "Maintenance", "proceng", "bad`table", "admin_group"],
            }),
        });

        expect(await getFisGroups("alice@example.com")).toEqual(["admin_group", "Maintenance", "proceng"]);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith(
            "http://10.142.11.20/custom/matz/phpBB/router.php?job=GetUserGroup",
            expect.objectContaining({
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({User: "alice"}),
            }),
        );
    });

    it("returns no privileged groups when router reports user not found in FIS", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                status: false,
                message: "Runtime error: Error: User 'alice' not found",
                data: null,
            }),
        });

        expect(await getFisGroups("alice")).toEqual([]);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("caches groups in memory and expires them after the TTL", async () => {
        vi.useFakeTimers();
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({status: true, message: "User group loaded", data: ["Maintenance"]}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({status: true, message: "User group loaded", data: ["admin_group"]}),
            });

        expect(await getFisGroups("alice@example.com")).toEqual(["Maintenance"]);
        expect(await getFisGroups("DOMAIN\\ALICE")).toEqual(["Maintenance"]);
        expect(fetchMock).toHaveBeenCalledOnce();

        vi.advanceTimersByTime(61_000);
        expect(await getFisGroups("alice")).toEqual(["admin_group"]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("fails closed when the router returns an HTTP error or runtime database failure", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                status: false,
                message: "Runtime error: Database error: Connection refused",
                data: null,
            }),
        });

        await expect(getFisGroups("alice")).rejects.toThrow("FIS GetUserGroup failed");
    });
});
