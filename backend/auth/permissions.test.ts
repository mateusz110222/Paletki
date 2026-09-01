import {describe, expect, it} from "vitest";
import {
    canChangePalletStatus,
    canOpenPalletInOperatorPanel,
    departmentAccess,
    hasITDepartmentAccess,
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

    it('computes independent department flags with exact normalized matches', () => {
        const lists = [['IT', 'Shared'], ['UR', 'Shared']] as const;
        expect(departmentAccess(' ur ', ...lists)).toEqual({has_it_department_access: false, has_ur_department_access: true, has_me_department_access: false});
        expect(departmentAccess('SHARED', ...lists)).toEqual({has_it_department_access: true, has_ur_department_access: true, has_me_department_access: false});
        for (const department of ['', 'IT support', 'Production']) {
            expect(departmentAccess(department, ...lists)).toEqual({has_it_department_access: false, has_ur_department_access: false, has_me_department_access: false});
        }
        expect(departmentAccess('UR', ['IT'], [])).toEqual({has_it_department_access: false, has_ur_department_access: false, has_me_department_access: false});
    });

    it('grants ME management without granting IT or LDAP directory access', () => {
        expect(departmentAccess('  bln - me ', ['IT'], ['UR'], ['BLN - ME'])).toEqual({
            has_it_department_access: false, has_ur_department_access: false, has_me_department_access: true,
        });
        expect(departmentAccess('ME', ['IT'], ['ME'], ['ME'])).toEqual({
            has_it_department_access: false, has_ur_department_access: true, has_me_department_access: true,
        });
        expect(departmentAccess('ME extra', ['IT'], ['UR'], ['ME']).has_me_department_access).toBe(false);
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

    it("grants privileged access only to configured LDAP departments", () => {
        const allowed = ["BLN - PDS IT Service Delivery", "BLN - PDS - IT"];

        expect(hasITDepartmentAccess("BLN - PDS IT Service Delivery", allowed)).toBe(true);
        expect(hasITDepartmentAccess("  bln - pds - it  ", allowed)).toBe(true);
        expect(hasITDepartmentAccess("Production", allowed)).toBe(false);
        expect(hasITDepartmentAccess("", allowed)).toBe(false);
    });
});
