import {beforeEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';

const mocks = vi.hoisted(() => ({
    queryRow: vi.fn(), exec: vi.fn(), findCard: vi.fn(), groups: vi.fn(),
    authenticateLdap: vi.fn(), password: vi.fn(() => 'secret'),
    apacs: {server: 'apacs', user: 'readonly'},
}));
vi.mock('encore.dev/api', () => {
    class TestAPIError extends Error {
        constructor(public code: string, message: string) {super(message);}
        static unauthenticated(message: string) {return new TestAPIError('unauthenticated', message);}
        static invalidArgument(message: string) {return new TestAPIError('invalid_argument', message);}
        static unavailable(message: string) {return new TestAPIError('unavailable', message);}
    }
    return {api: (_options: unknown, handler: unknown) => handler, APIError: TestAPIError, Gateway: class {}};
});
vi.mock('encore.dev/auth', () => ({authHandler: (handler: unknown) => handler}));
vi.mock('~encore/auth', () => ({getAuthData: vi.fn()}));
vi.mock('../shared/persistence', () => ({palletsDatabase: {exec: mocks.exec, queryRow: mocks.queryRow}}));
vi.mock('../config', () => ({config: {
    auth: {sessionTtlMinutes: 720}, apacs: mocks.apacs,
    fisGroups: {itGroups: ['admin'], urGroup: 'Maintenance', meGroup: 'proceng'},
    ldap: {loginDomain: 'example', searchBase: 'dc=example', timeoutMs: 5000},
}}));
vi.mock('./apacs', () => ({findActiveCardOperator: mocks.findCard}));
vi.mock('./secrets', () => ({apacsDbPassword: mocks.password}));
vi.mock('./fis-groups', () => ({getFisGroups: mocks.groups}));
vi.mock('./ldap-client', () => ({createLdapClient: vi.fn()}));
vi.mock('./ldap', () => ({
    authenticateLdapUser: mocks.authenticateLdap,
    withLdapClient: (_client: unknown, action: () => unknown) => action(),
    parseLdapLogin: vi.fn(), classifyLdapError: vi.fn(), InvalidLdapLoginError: class extends Error {},
}));

import {authentication, CardLogin, Login} from './auth';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.apacs.server = 'apacs';
    mocks.password.mockReturnValue('secret');
    mocks.findCard.mockResolvedValue({externalId: '17', fullName: 'Anna Nowak'});
    mocks.exec.mockResolvedValue(undefined);
    mocks.groups.mockResolvedValue(['admin']);
});

describe('card login and session authorization', () => {
    it('creates an operator session with an opaque token and employee name, without FIS access', async () => {
        const result = await CardLogin({identifier: ' 00123 ', acceptLanguage: 'pl'});
        expect(mocks.findCard).toHaveBeenCalledWith('00123');
        expect(result.data).toMatchObject({
            username: 'apacs:17', FullName: 'Anna Nowak', role: 'operator', is_guest: false,
            has_it_department_access: false, has_ur_department_access: false, has_me_department_access: false,
        });
        expect(result.token).toBeTruthy();
        const values = mocks.exec.mock.calls[1].slice(1);
        expect(values).toContain('Anna Nowak');
        expect(values).toContain('apacs:17');
        expect(values).not.toContain('00123');
        expect(mocks.groups).not.toHaveBeenCalled();
        mocks.queryRow.mockResolvedValue({username: 'apacs:17', full_name: 'Anna Nowak', department: '', title: 'Operator'});
        expect(await authentication({authorization: `Bearer ${result.token}`})).toMatchObject({
            fullName: 'Anna Nowak', hasITDepartmentAccess: false, hasURDepartmentAccess: false, hasMEDepartmentAccess: false,
        });
        expect(mocks.groups).not.toHaveBeenCalled();
    });

    for (const identifier of ['', '123a', '1.2', '-123', '1 23', '1'.repeat(31)]) {
        it(`rejects invalid input ${JSON.stringify(identifier)}`, async () => {
            await expect(CardLogin({identifier})).rejects.toMatchObject({code: 'invalid_argument'});
            expect(mocks.findCard).not.toHaveBeenCalled();
            expect(mocks.exec).not.toHaveBeenCalled();
        });
    }

    it('rejects unknown cards with localized messages and no session', async () => {
        mocks.findCard.mockResolvedValue(null);
        await expect(CardLogin({identifier: '1', acceptLanguage: 'en'})).rejects.toMatchObject({
            code: 'unauthenticated', message: expect.stringContaining('The card'),
        });
        await expect(CardLogin({identifier: '1', acceptLanguage: 'pl'})).rejects.toMatchObject({
            message: expect.stringContaining('Karta'),
        });
        expect(mocks.exec).not.toHaveBeenCalled();
    });

    it('reports missing configuration and APACS outages without a fallback session', async () => {
        mocks.password.mockReturnValue('');
        await expect(CardLogin({identifier: '1'})).rejects.toMatchObject({code: 'unavailable'});
        expect(mocks.findCard).not.toHaveBeenCalled();
        mocks.password.mockReturnValue('secret');
        mocks.findCard.mockRejectedValue(new Error('private details'));
        await expect(CardLogin({identifier: '1', acceptLanguage: 'en'})).rejects.toMatchObject({
            code: 'unavailable', message: 'The access control system is temporarily unavailable.',
        });
        expect(mocks.exec).not.toHaveBeenCalled();
    });

    it('rejects old manual sessions and removes the old endpoint', async () => {
        mocks.queryRow.mockResolvedValue({username: 'operator:someone'});
        await expect(authentication({authorization: `Bearer ${'x'.repeat(43)}`})).rejects.toMatchObject({code: 'unauthenticated'});
        expect(mocks.groups).not.toHaveBeenCalled();
        const source = readFileSync(new URL('./auth.ts', import.meta.url), 'utf8');
        expect(source).not.toContain('path: "/auth/operator-session"');
    });

    it('retains LDAP login and FIS group authorization', async () => {
        mocks.authenticateLdap.mockResolvedValue({username: 'anna', fullName: 'Anna Nowak', department: 'IT', title: 'Engineer'});
        const result = await Login({login: 'anna', password: 'password'});
        expect(result.data.has_it_department_access).toBe(true);
        mocks.queryRow.mockResolvedValue({username: 'anna', full_name: 'Anna Nowak'});
        expect(await authentication({authorization: `Bearer ${result.token}`})).toMatchObject({hasITDepartmentAccess: true});
        expect(mocks.groups).toHaveBeenCalledTimes(2);
    });
});
