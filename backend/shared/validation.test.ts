import {describe, expect, it} from "vitest";
import {
    isFisSafeText,
    isSafePositiveInteger,
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
