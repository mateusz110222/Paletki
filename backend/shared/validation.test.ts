import {describe, expect, it} from "vitest";
import {
    isFisSafeText,
    isSafePositiveInteger,
    calculateRangeMaxCycles,
    normalizePalletId,
    normalizePalletStatus,
} from "./validation";

describe("shared API validation", () => {
    it("normalizes pallet identifiers", () => {
        expect(normalizePalletId("  pal-01  ")).toBe("PAL-01");
    });

    it("normalizes supported statuses without accepting unknown values", () => {
        expect(normalizePalletStatus(" washing_required ")).toBe("Washing_Required");
        expect(normalizePalletStatus("removed")).toBeNull();
    });

    it("accepts only positive safe integers", () => {
        expect(isSafePositiveInteger(1)).toBe(true);
        expect(isSafePositiveInteger(1.5)).toBe(false);
        expect(isSafePositiveInteger(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    });

    it("rejects FIS separators and control characters", () => {
        expect(isFisSafeText("PROJECT-01")).toBe(true);
        expect(isFisSafeText("PROJECT|MODEL")).toBe(false);
        expect(isFisSafeText("PROJECT\nMODEL")).toBe(false);
    });
});

describe("range cycle stepping", () => {
    it("keeps one limit when stepping is not configured", () => {
        expect(calculateRangeMaxCycles(200, 17)).toBe(200);
    });

    it("decreases the limit after each complete pallet group", () => {
        expect(Array.from({length: 12}, (_, index) => calculateRangeMaxCycles(200, index, 10, 10)))
            .toEqual([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 190, 190]);
    });

    it("rejects incomplete, non-positive and overflowing step settings", () => {
        expect(calculateRangeMaxCycles(200, 0, 10)).toBeNull();
        expect(calculateRangeMaxCycles(200, 0, 0, 10)).toBeNull();
        expect(calculateRangeMaxCycles(1, 1, 1, 1)).toBeNull();
        expect(calculateRangeMaxCycles(10, 2, 1, 10)).toBeNull();
        expect(calculateRangeMaxCycles(1_000_001, 1, 1, 10)).toBeNull();
        expect(calculateRangeMaxCycles(11, 1, 1, 10)).toBe(1);
    });
});
