import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {APIError} from 'encore.dev/api';
import {InvalidCredentialsError} from 'ldapts';

vi.mock('encore.dev/api', () => {
    class TestAPIError extends Error {
        constructor(public code: string, message: string) { super(message); }
        static permissionDenied(message: string) { return new TestAPIError('permission_denied', message); }
        static invalidArgument(message: string) { return new TestAPIError('invalid_argument', message); }
        static unavailable(message: string) { return new TestAPIError('unavailable', message); }
        static notFound(message: string) { return new TestAPIError('not_found', message); }
    }
    return {APIError: TestAPIError, api: (_options: unknown, handler: unknown) => handler};
});

const mocks = vi.hoisted(() => ({
    requireIT: vi.fn(),
    bind: vi.fn(),
    search: vi.fn(),
    unbind: vi.fn(),
    createClient: vi.fn(),
    ldap: {lookupBindUser: 'reader@example.test', lookupBindPassword: 'test-only',
        searchBase: 'DC=test', timeoutMs: 1000, itDepartments: ['IT'], urDepartments: ['UR'], meDepartments: ['ME']},
}));
vi.mock('./authorization', () => ({requireITDepartmentUser: mocks.requireIT}));
vi.mock('./ldap-client', () => ({createLdapClient: mocks.createClient}));
vi.mock('../config', () => ({config: {ldap: mocks.ldap}}));
vi.mock('./secrets', () => ({ldapLookupBindPassword: () => mocks.ldap.lookupBindPassword}));
import {LookupDirectoryUser} from './directory';

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.ldap.lookupBindPassword = 'test-only';
    mocks.createClient.mockReturnValue({bind: mocks.bind, search: mocks.search, unbind: mocks.unbind});
    mocks.bind.mockResolvedValue(undefined);
    mocks.unbind.mockResolvedValue(undefined);
    mocks.search.mockResolvedValue({searchEntries: [{dn: 'CN=Test', sAMAccountName: 'test', department: 'UR'}]});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('IT-only directory endpoint', () => {
    it('reports ME access in a lookup without marking the target as IT', async () => {
        mocks.search.mockResolvedValue({searchEntries: [{dn: 'CN=Test', sAMAccountName: 'test', department: 'ME'}]});
        expect(await LookupDirectoryUser({net_id: 'test'})).toMatchObject({
            has_it_department_access: false, has_ur_department_access: false, has_me_department_access: true,
        });
    });
    it('rejects unauthorized users before any LDAP operation', async () => {
        mocks.requireIT.mockImplementation(() => { throw APIError.permissionDenied('IT only'); });
        await expect(LookupDirectoryUser({net_id: 'test'})).rejects.toMatchObject({code: 'permission_denied'});
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it('rejects invalid NetIDs before connecting', async () => {
        await expect(LookupDirectoryUser({net_id: '*'})).rejects.toMatchObject({code: 'invalid_argument'});
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it('requires service-account configuration', async () => {
        mocks.ldap.lookupBindPassword = '';
        await expect(LookupDirectoryUser({net_id: 'test'})).rejects.toMatchObject({code: 'unavailable'});
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it('returns department flags and unbinds without exposing credentials', async () => {
        const result = await LookupDirectoryUser({net_id: ' test '});
        expect(result).toMatchObject({net_id: 'test', has_it_department_access: false, has_ur_department_access: true});
        expect(JSON.stringify(result)).not.toContain('test-only');
        expect(mocks.bind).toHaveBeenCalledWith('reader@example.test', 'test-only');
        expect(mocks.unbind).toHaveBeenCalledOnce();
        expect(console.error).not.toHaveBeenCalled();
    });

    it('returns a localized not-found error and closes the client', async () => {
        mocks.search.mockResolvedValue({searchEntries: []});
        await expect(LookupDirectoryUser({net_id: 'test', acceptLanguage: 'en'})).rejects.toMatchObject({code: 'not_found', message: 'No user was found with this NetID.'});
        expect(mocks.unbind).toHaveBeenCalledOnce();
    });

    it('does not expose bind diagnostics or log out the IT user when LDAP fails', async () => {
        mocks.bind.mockRejectedValue(new Error('sensitive directory details'));
        await expect(LookupDirectoryUser({net_id: 'test', acceptLanguage: 'en'})).rejects.toMatchObject({code: 'unavailable', message: expect.not.stringContaining('sensitive')});
        expect(mocks.search).not.toHaveBeenCalled();
        expect(mocks.unbind).toHaveBeenCalledOnce();
        expect(vi.mocked(console.error).mock.calls).toEqual([['LDAP directory lookup failed', {stage: 'bind', kind: 'unknown'}]]);
    });

    it('logs a safe category for invalid configured credentials', async () => {
        mocks.bind.mockRejectedValue(new InvalidCredentialsError('sensitive directory details'));
        await expect(LookupDirectoryUser({net_id: 'test'})).rejects.toMatchObject({code: 'unavailable'});
        expect(vi.mocked(console.error).mock.calls).toEqual([['LDAP directory lookup failed', {stage: 'bind', kind: 'invalid_credentials'}]]);
        expect(mocks.search).not.toHaveBeenCalled();
    });

    it('distinguishes a search timeout from a bind failure without logging raw details', async () => {
        mocks.search.mockRejectedValue(Object.assign(new Error('sensitive directory details'), {code: 'ETIMEDOUT'}));
        await expect(LookupDirectoryUser({net_id: 'test'})).rejects.toMatchObject({code: 'unavailable'});
        expect(vi.mocked(console.error).mock.calls).toEqual([['LDAP directory lookup failed', {stage: 'search', kind: 'timeout'}]]);
        expect(mocks.unbind).toHaveBeenCalledOnce();
    });
});
