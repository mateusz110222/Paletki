import {describe, expect, it, vi} from "vitest";
import {Pallet} from "../shared/types";
import {FisClient, migrateFisUnit} from "./fis-client";

vi.mock("encore.dev/api", () => {
    class TestAPIError extends Error {
        static unavailable(message: string, cause?: Error): TestAPIError {
            return new TestAPIError(message, {cause});
        }

        static internal(message: string, cause?: Error): TestAPIError {
            return new TestAPIError(message, {cause});
        }

        static failedPrecondition(message: string): TestAPIError {
            return new TestAPIError(message);
        }
    }

    return {APIError: TestAPIError};
});

function fisResponse(status: boolean, message?: string): Response {
    return new Response(JSON.stringify({status, message}), {
        status: 200,
        headers: {"Content-Type": "application/json"},
    });
}

function testPallet(fis: number): Pallet {
    return {
        id: 1,
        pallet_id: "PAL-1",
        project: "PROJECT",
        model: "MODEL",
        max_cycles: 200,
        current_cycles: 0,
        total_cycles: 0,
        nests: 1,
        status: "Active",
        fis,
        created_at: new Date(0),
        created_by: "TEST",
        updated_at: new Date(0),
    };
}

function requestedOperations(fetchMock: ReturnType<typeof vi.fn>): string[] {
    return fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("job") ?? "");
}

describe("FIS pallet synchronization", () => {
    it("creates the pallet on the new FIS and removes it from the old FIS", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(fisResponse(false))
            .mockResolvedValueOnce(fisResponse(true))
            .mockResolvedValueOnce(fisResponse(true))
            .mockResolvedValueOnce(fisResponse(true));
        const client = new FisClient(1_000, fetchMock as typeof fetch);
        const routerForFis = (fis: number) => `http://fis-${fis}.test/router.php`;

        await expect(migrateFisUnit(
            client,
            routerForFis,
            testPallet(1),
            2,
            "OPERATOR",
            "pl",
        )).resolves.toBe(true);

        expect(requestedOperations(fetchMock)).toEqual([
            "Unit_Find",
            "Unit_DataEntry",
            "Unit_Find",
            "Unit_Delete",
        ]);
        expect(String(fetchMock.mock.calls[0][0])).toContain("fis-2.test");
        expect(String(fetchMock.mock.calls[2][0])).toContain("fis-1.test");
    });

    it("does not call FIS when the assignment did not change", async () => {
        const fetchMock = vi.fn();
        const client = new FisClient(1_000, fetchMock as typeof fetch);

        await expect(migrateFisUnit(
            client,
            (fis) => `http://fis-${fis}.test/router.php`,
            testPallet(1),
            1,
            "OPERATOR",
        )).resolves.toBe(false);

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("removes the new FIS copy if deleting the old copy fails", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(fisResponse(false))
            .mockResolvedValueOnce(fisResponse(true))
            .mockResolvedValueOnce(fisResponse(true))
            .mockResolvedValueOnce(fisResponse(false, "delete rejected"))
            .mockResolvedValueOnce(fisResponse(true))
            .mockResolvedValueOnce(fisResponse(true));
        const client = new FisClient(1_000, fetchMock as typeof fetch);

        await expect(migrateFisUnit(
            client,
            (fis) => `http://fis-${fis}.test/router.php`,
            testPallet(1),
            2,
            "OPERATOR",
            "en",
        )).rejects.toThrow("delete rejected");

        expect(requestedOperations(fetchMock)).toEqual([
            "Unit_Find",
            "Unit_DataEntry",
            "Unit_Find",
            "Unit_Delete",
            "Unit_Find",
            "Unit_Delete",
        ]);
        expect(String(fetchMock.mock.calls[4][0])).toContain("fis-2.test");
    });

    it("deletes an assigned pallet only when it exists on FIS", async () => {
        const presentFetch = vi.fn()
            .mockResolvedValueOnce(fisResponse(true))
            .mockResolvedValueOnce(fisResponse(true));
        const presentClient = new FisClient(1_000, presentFetch as typeof fetch);

        await expect(presentClient.deleteUnitIfPresent(
            "http://fis-1.test/router.php",
            "PAL-1",
        )).resolves.toBe(true);
        expect(requestedOperations(presentFetch)).toEqual(["Unit_Find", "Unit_Delete"]);

        const absentFetch = vi.fn().mockResolvedValueOnce(fisResponse(false));
        const absentClient = new FisClient(1_000, absentFetch as typeof fetch);
        await expect(absentClient.deleteUnitIfPresent(
            "http://fis-1.test/router.php",
            "PAL-1",
        )).resolves.toBe(false);
        expect(requestedOperations(absentFetch)).toEqual(["Unit_Find"]);
    });

    it("cleans up a possibly created unit when FIS rejects its creation", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(fisResponse(false))
            .mockResolvedValueOnce(fisResponse(false, "create rejected"))
            .mockResolvedValueOnce(fisResponse(true))
            .mockResolvedValueOnce(fisResponse(true));
        const client = new FisClient(1_000, fetchMock as typeof fetch);

        await expect(client.synchronizeUnit(
            "http://fis-1.test/router.php",
            {pallet_id: "PAL-1", project: "PROJECT", model: "MODEL"},
            "OPERATOR",
            "en",
        )).rejects.toThrow("create rejected");

        expect(requestedOperations(fetchMock)).toEqual([
            "Unit_Find",
            "Unit_DataEntry",
            "Unit_Find",
            "Unit_Delete",
        ]);
    });

    it("reports connection failures as a FIS availability error", async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
        const client = new FisClient(1_000, fetchMock as typeof fetch);

        await expect(client.deleteUnitIfPresent(
            "http://fis-1.test/router.php",
            "PAL-1",
            "en",
        )).rejects.toThrow("Could not connect to the FIS service");
    });

    it("rejects malformed FIS responses", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({message: "missing status"})));
        const client = new FisClient(1_000, fetchMock as typeof fetch);

        await expect(client.deleteUnitIfPresent(
            "http://fis-1.test/router.php",
            "PAL-1",
            "en",
        )).rejects.toThrow("invalid response");
    });
});
