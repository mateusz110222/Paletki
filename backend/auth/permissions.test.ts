import {describe, expect, it} from "vitest";
import {
    canChangePalletStatus,
    canOpenPalletInOperatorPanel,
    fisGroupAccess,
    OPERATOR_OTHER_FAULT_STATUS,
} from "./permissions";

describe("pallet authorization policy", () => {
    it('grants UR only maintenance transitions', () => {
        expect(canChangePalletStatus(false, 'Active', true, true)).toBe(true);
        expect(canChangePalletStatus(false, 'Damaged', false, true)).toBe(true);
        expect(canChangePalletStatus(false, 'Active', false, true)).toBe(false);
        expect(canChangePalletStatus(false, 'Damaged', true, true)).toBe(false);
        expect(canChangePalletStatus(false, 'Blocked', false, true)).toBe(false);
        expect(canChangePalletStatus(false, 'Washing_Required', false, true)).toBe(false);
        expect(canChangePalletStatus(true, 'Blocked', false, true)).toBe(true);
    });

    it('maps exact FIS groups to IT, UR and ME access', () => {
        const itGroups = ['fisadmin_group', 'admin_group'];
        const access = (groups: string[]) => fisGroupAccess(groups, itGroups, 'Maintenance', 'proceng');
        for (const group of itGroups) {
            expect(access([group])).toEqual({has_it_department_access: true, has_ur_department_access: true, has_me_department_access: false});
        }
        expect(access(['Maintenance'])).toEqual({has_it_department_access: false, has_ur_department_access: true, has_me_department_access: false});
        expect(access(['proceng'])).toEqual({has_it_department_access: false, has_ur_department_access: false, has_me_department_access: true});
        expect(access(['Maintenance', 'proceng'])).toEqual({has_it_department_access: false, has_ur_department_access: true, has_me_department_access: true});
        expect(access(['maintenance', 'admin_group_extra', 'support_group'])).toEqual({has_it_department_access: false, has_ur_department_access: false, has_me_department_access: false});
    });

    it('keeps legacy ME transition behavior available for existing callers', () => {
        for (const ur of [false, true]) {
            expect(canChangePalletStatus(false, 'Active', true, ur, true)).toBe(true);
            expect(canChangePalletStatus(false, 'Active', false, ur, true)).toBe(true);
            expect(canChangePalletStatus(false, 'Blocked', false, ur, true)).toBe(true);
            expect(canChangePalletStatus(false, 'Washing_Required', false, ur, true)).toBe(true);
        }
    });
    it("allows staff to perform maintenance transitions", () => {
        expect(canChangePalletStatus(true, "Active", true)).toBe(true);
    });

    it("allows operators to report faults without resetting cycles", () => {
        expect(canChangePalletStatus(false, "Damaged", false)).toBe(true);
        expect(canChangePalletStatus(false, "Washing_Required", false)).toBe(true);
        expect(canChangePalletStatus(false, "Blocked", false)).toBe(false);
    });

    it("keeps blocked pallets out of the operator panel", () => {
        expect(canOpenPalletInOperatorPanel("Active")).toBe(true);
        expect(canOpenPalletInOperatorPanel("Damaged")).toBe(true);
        expect(canOpenPalletInOperatorPanel("Washing_Required")).toBe(true);
        expect(canOpenPalletInOperatorPanel("Blocked")).toBe(false);
    });

    it("reports a custom operator fault as damaged, not blocked", () => {
        expect(OPERATOR_OTHER_FAULT_STATUS).toBe("Damaged");
    });

    it("prevents operators from reactivating pallets or resetting cycles", () => {
        expect(canChangePalletStatus(false, "Active", false)).toBe(false);
        expect(canChangePalletStatus(false, "Damaged", true)).toBe(false);
    });

});
