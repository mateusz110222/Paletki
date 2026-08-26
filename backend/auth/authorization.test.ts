import {describe, expect, it, vi} from 'vitest';

const {getAuthData} = vi.hoisted(() => ({getAuthData: vi.fn()}));
vi.mock('~encore/auth', () => ({getAuthData}));
vi.mock('encore.dev/api', () => {
    class TestAPIError extends Error {
        constructor(public code: string, message: string) { super(message); }
        static permissionDenied(message: string) { return new TestAPIError('permission_denied', message); }
        static unauthenticated(message: string) { return new TestAPIError('unauthenticated', message); }
    }
    return {APIError: TestAPIError};
});
import {requireITDepartmentUser, requirePalletManagementUser} from './authorization';

describe('department authorization guards', () => {
    for (const itAccess of [false, true]) {
        for (const urAccess of [false, true]) {
            for (const meAccess of [false, true]) {
                it(`IT=${itAccess}, UR=${urAccess}, ME=${meAccess}`, () => {
                    const auth = {hasITDepartmentAccess: itAccess, hasURDepartmentAccess: urAccess, hasMEDepartmentAccess: meAccess};
                    getAuthData.mockReturnValue(auth);
                    if (itAccess) expect(requireITDepartmentUser()).toBe(auth);
                    else expect(() => requireITDepartmentUser()).toThrow(expect.objectContaining({code: 'permission_denied'}));
                    if (itAccess || meAccess) expect(requirePalletManagementUser()).toBe(auth);
                    else expect(() => requirePalletManagementUser()).toThrow(expect.objectContaining({code: 'permission_denied'}));
                });
            }
        }
    }

    it('rejects anonymous requests for both guards', () => {
        getAuthData.mockReturnValue(null);
        expect(() => requireITDepartmentUser()).toThrow(expect.objectContaining({code: 'unauthenticated'}));
        expect(() => requirePalletManagementUser()).toThrow(expect.objectContaining({code: 'unauthenticated'}));
    });
});
