import {describe, expect, it} from "vitest";
import {canChangePalletStatus, hasITDepartmentAccess} from "./permissions";

describe("pallet authorization policy", () => {
    it("allows staff to perform maintenance transitions", () => {
        expect(canChangePalletStatus(true, "Active", true)).toBe(true);
    });

    it("allows operators to report faults without resetting cycles", () => {
        expect(canChangePalletStatus(false, "Damaged", false)).toBe(true);
        expect(canChangePalletStatus(false, "Washing_Required", false)).toBe(true);
        expect(canChangePalletStatus(false, "Blocked", false)).toBe(true);
    });

    it("prevents operators from reactivating pallets or resetting cycles", () => {
        expect(canChangePalletStatus(false, "Active", false)).toBe(false);
        expect(canChangePalletStatus(false, "Damaged", true)).toBe(false);
    });

    it("grants privileged access only to configured LDAP departments", () => {
        const allowed = ["BLN - PDS IT Service Delivery", "BLN - PDS - IT"];

        expect(hasITDepartmentAccess("BLN - PDS IT Service Delivery", allowed)).toBe(true);
        expect(hasITDepartmentAccess("  bln - pds - it  ", allowed)).toBe(true);
        expect(hasITDepartmentAccess("Production", allowed)).toBe(false);
        expect(hasITDepartmentAccess("", allowed)).toBe(false);
    });
});
