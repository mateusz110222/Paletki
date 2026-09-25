import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({query: vi.fn(), createPool: vi.fn()}));
vi.mock("mysql2/promise", () => ({createPool: mocks.createPool}));
vi.mock("../config", () => ({config: {fisGroups: {host: "fis.test", port: 3306, user: "reader"}}}));
vi.mock("./secrets", () => ({fisDbPassword: () => "secret"}));

import {fisNetId, getFisGroups} from "./fis-groups";

beforeEach(() => {
    mocks.query.mockReset();
    mocks.createPool.mockReturnValue({query: mocks.query});
});

describe("FIS group lookup", () => {
    it("normalizes an LDAP UPN to the FIS NetID", () => {
        expect(fisNetId("DOMAIN\\Alice@example.com")).toBe("Alice");
    });

    it("rejects unsafe identifiers before querying FIS", async () => {
        await expect(getFisGroups("bad user@example.com")).rejects.toThrow("Invalid FIS user identifier");
        expect(mocks.query).not.toHaveBeenCalled();
    });

    it("reads the MasterSamples users/groupList schema and skips unsafe table names", async () => {
        mocks.query
            .mockResolvedValueOnce([[{pk: 17}]])
            .mockResolvedValueOnce([[{tableName: "admin_group"}, {tableName: "Maintenance"}, {tableName: "proceng"}, {tableName: "bad`table"}]])
            .mockResolvedValueOnce([[{group_name: "admin_group"}, {group_name: "admin_group"}]]);
        expect(await getFisGroups("alice@example.com")).toEqual(["admin_group"]);
        expect(mocks.query).toHaveBeenNthCalledWith(1, expect.stringContaining("`users`.`tbl_users`"), ["alice", "alice"]);
        const [sql, values] = mocks.query.mock.calls[2];
        expect(sql).toContain("`groups`.`admin_group`");
        expect(sql).toContain("`groups`.`Maintenance`");
        expect(sql).toContain("`groups`.`proceng`");
        expect(sql).not.toContain("bad`table");
        expect(values).toEqual(["admin_group", 17, "Maintenance", 17, "proceng", 17]);
    });

    it("returns no privileged groups for users absent from FIS", async () => {
        mocks.query.mockResolvedValueOnce([[]]);
        expect(await getFisGroups("alice")).toEqual([]);
        expect(mocks.query).toHaveBeenCalledOnce();
    });
});
