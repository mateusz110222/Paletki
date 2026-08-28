import {describe, expect, it, vi} from "vitest";
import {FisClient} from "./fis-client";

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

function requestedOperations(fetchMock: ReturnType<typeof vi.fn>): string[] {
    return fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("job") ?? "");
}

describe("FIS pallet synchronization", () => {
    it("does not recreate a unit that already exists during reconciliation", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(fisResponse(true));
        const client = new FisClient(1_000, fetchMock as typeof fetch);

        await expect(client.ensureUnitPresent(
            "http://fis-1.test/router.php",
            {pallet_id: "PAL-1", project: "PROJECT", model: "MODEL"},
            "SYSTEM_RECONCILIATION",
        )).resolves.toBeUndefined();

        expect(requestedOperations(fetchMock)).toEqual(["Unit_Find"]);
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
