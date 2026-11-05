import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {EventEmitter} from 'node:events';

const mocks = vi.hoisted(() => ({
    input: vi.fn(), query: vi.fn(), connect: vi.fn(), password: vi.fn(() => 'secret'),
}));
vi.mock('../config', () => ({config: {apacs: {server: 'apacs', user: 'readonly'}}}));
vi.mock('./secrets', () => ({apacsDbPassword: mocks.password}));
vi.mock('mssql', () => ({default: {
    VarChar: (size: number) => `varchar(${size})`, Int: 'int',
    ConnectionPool: class extends EventEmitter {
        connect = mocks.connect;
    },
}}));

const assignment = {
    externalId: 17, firstName: ' Anna ', lastName: ' Nowak ', active: 1,
    validFrom: null, validTo: null, overrideActive: 0,
};

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.password.mockReturnValue('secret');
    mocks.input.mockReturnThis();
    mocks.query.mockResolvedValue({recordset: [assignment]});
    mocks.connect.mockResolvedValue({request: () => ({input: mocks.input, query: mocks.query})});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function lookup(identifier = '00123') {
    return (await import('./apacs')).findActiveCardOperator(identifier);
}

describe('APACS card verification', () => {
    it('handles asynchronous pool errors without throwing or logging sensitive details', async () => {
        await lookup();
        const pool = mocks.connect.mock.contexts[0] as EventEmitter;
        for (const [code, expectedCode] of [['ESOCKET', 'ESOCKET'], ['7992 password', 'UNKNOWN']]) {
            const error = Object.assign(new Error('private password and card 7992'), {code});
            expect(() => pool.emit('error', error)).not.toThrow();
            expect(console.error).toHaveBeenLastCalledWith('APACS failure', {stage: 'pool', code: expectedCode});
        }
        expect(await lookup()).toEqual({externalId: '17', fullName: 'Anna Nowak'});
        expect(mocks.connect).toHaveBeenCalledTimes(1);
    });

    it('accepts a 256-character identity and rejects longer names', async () => {
        mocks.query.mockResolvedValue({recordset: [{...assignment, firstName: 'A'.repeat(128), lastName: 'B'.repeat(127)}]});
        expect((await lookup())?.fullName).toHaveLength(256);
        mocks.query.mockResolvedValue({recordset: [{...assignment, firstName: 'A'.repeat(128), lastName: 'B'.repeat(128)}]});
        expect(await lookup()).toBeNull();
    });
    it('keeps leading zeros in the parameter and returns employee identity', async () => {
        expect(await lookup()).toEqual({externalId: '17', fullName: 'Anna Nowak'});
        expect(mocks.input.mock.calls).toEqual([
            ['identifier', 'varchar(30)', '00123'], ['cardNumber', 'int', 123],
        ]);
        expect(mocks.query.mock.calls[0][0]).toContain('ci.FCARDNUM = @cardNumber');
        expect(mocks.query.mock.calls[0][0]).not.toContain('00123');
    });

    it('does not overflow SQL INT for a long text number', async () => {
        await lookup('999999999999999999999999999999');
        expect(mocks.input).toHaveBeenCalledWith('cardNumber', 'int', null);
    });

    for (const [label, rows] of [
        ['unknown', []],
        ['inactive', [{...assignment, active: 0, overrideActive: 1}]],
        ['future', [{...assignment, validFrom: new Date('2999-01-01')}]],
        ['expired', [{...assignment, validTo: new Date('2000-01-01')}]],
        ['ambiguous', [assignment, {...assignment, externalId: 18, active: 0}]],
        ['missing name', [{...assignment, firstName: null, lastName: null}]],
    ] as const) {
        it(`rejects ${label} cards`, async () => {
            mocks.query.mockResolvedValue({recordset: rows});
            expect(await lookup()).toBeNull();
        });
    }

    it('accepts date override and multiple assignments for the same employee', async () => {
        mocks.query.mockResolvedValue({recordset: [
            {...assignment, active: 0},
            {...assignment, validTo: new Date('2000-01-01'), overrideActive: 1},
        ]});
        expect(await lookup()).toEqual({externalId: '17', fullName: 'Anna Nowak'});
    });

    it('reuses the pool and retries after connection failure without leaking driver errors', async () => {
        const cause = Object.assign(new Error('private password and card 7992'), {code: 'ESOCKET'});
        mocks.connect.mockRejectedValueOnce(cause);
        await expect(lookup()).rejects.toThrow('APACS connection unavailable');
        expect(console.error).toHaveBeenCalledExactlyOnceWith('APACS failure', {stage: 'connect', code: 'ESOCKET'});
        await lookup();
        await lookup();
        expect(mocks.connect).toHaveBeenCalledTimes(2);
    });

    it('logs query stage and driver code without sensitive details', async () => {
        const cause = Object.assign(new Error('private password and card 7992'), {code: 'EREQUEST'});
        mocks.query.mockRejectedValue(cause);
        await expect(lookup()).rejects.toMatchObject({message: 'APACS query unavailable', cause});
        expect(console.error).toHaveBeenCalledExactlyOnceWith('APACS failure', {stage: 'query', code: 'EREQUEST'});
    });
    it('does not log arbitrary values supplied as error codes', async () => {
        mocks.query.mockRejectedValue(Object.assign(new Error('private details'), {code: '7992 password'}));
        await expect(lookup()).rejects.toThrow('APACS query unavailable');
        expect(console.error).toHaveBeenCalledExactlyOnceWith('APACS failure', {stage: 'query', code: 'UNKNOWN'});
    });
});
