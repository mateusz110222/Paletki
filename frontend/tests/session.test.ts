import assert from 'node:assert/strict';
import test from 'node:test';
import {isCurrentSessionToken, parseStoredSession} from '../src/auth/session.ts';

const validSession = {
    user: {
        FullName: 'Jan Kowalski',
        department: 'IT',
        title: 'Engineer',
        username: 'jkowalski',
        role: 'staff',
        has_it_department_access: true,
        has_ur_department_access: false,
        has_me_department_access: false,
        is_guest: false,
    },
    token: 'valid-token',
    expiresAt: '2030-01-01T00:00:00.000Z',
};

test('parseStoredSession accepts a structurally valid non-expired session', () => {
    assert.deepEqual(
        parseStoredSession(JSON.stringify(validSession), Date.parse('2029-01-01T00:00:00.000Z')),
        validSession,
    );
});

test('parseStoredSession rejects expired and empty-token sessions', () => {
    assert.equal(
        parseStoredSession(JSON.stringify(validSession), Date.parse(validSession.expiresAt)),
        null,
    );
    assert.equal(parseStoredSession(JSON.stringify({...validSession, token: ''}), 0), null);
});

test('parseStoredSession rejects malformed storage values', () => {
    assert.equal(parseStoredSession('{invalid-json'), null);
    assert.equal(parseStoredSession(JSON.stringify({...validSession, user: {}}), 0), null);
});

test('unauthorized responses only apply to the current local and shared session', () => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    let stored: string | null = JSON.stringify(validSession);
    let blocked = false;
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
        getItem: () => {
            if (blocked) throw new Error('Storage blocked');
            return stored;
        },
    }});
    try {
        assert.equal(isCurrentSessionToken('valid-token', 'valid-token'), true);
        assert.equal(isCurrentSessionToken('old-token', 'valid-token'), false);
        assert.equal(isCurrentSessionToken('valid-token', undefined), false);
        assert.equal(isCurrentSessionToken(undefined, undefined), false);

        // The new login has reached storage, but its notification is still queued.
        stored = JSON.stringify({...validSession, token: 'new-token'});
        assert.equal(isCurrentSessionToken('valid-token', 'valid-token'), false);

        stored = null;
        assert.equal(isCurrentSessionToken('valid-token', 'valid-token'), true);
        blocked = true;
        assert.equal(isCurrentSessionToken('valid-token', 'valid-token'), true);
        assert.equal(isCurrentSessionToken('old-token', 'valid-token'), false);
    } finally {
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});

test('a delayed HTTP 401 from an old API client cannot log out a new session', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const originalFetch = globalThis.fetch;
    let currentToken = 'valid-token';
    let logoutCount = 0;
    let respond!: (response: Response) => void;
    let started!: () => void;
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    Object.defineProperty(globalThis, 'window', {configurable: true, value: {location: {origin: 'http://qa.test'}}});
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
        getItem: () => JSON.stringify({...validSession, token: currentToken}),
    }});
    globalThis.fetch = async () => {
        started();
        return new Promise<Response>(resolve => { respond = resolve; });
    };
    try {
        const {authenticatedApi} = await import('../src/lib/api.ts');
        const requestToken = currentToken;
        const oldClient = authenticatedApi(requestToken, 'pl', () => {
            if (isCurrentSessionToken(requestToken, currentToken)) logoutCount++;
        });
        const request = assert.rejects(oldClient.pallet.GetDefects());
        await requestStarted;
        currentToken = 'new-token';
        respond(new Response(JSON.stringify({code: 'unauthenticated', message: 'Expired session'}), {status: 401}));
        await request;
        assert.equal(logoutCount, 0);
        assert.equal(currentToken, 'new-token');

        // A 401 for the new token must still trigger the normal logout path.
        globalThis.fetch = async () => new Response(JSON.stringify({code: 'unauthenticated', message: 'Expired session'}), {status: 401});
        const newClient = authenticatedApi(currentToken, 'pl', () => {
            if (isCurrentSessionToken('new-token', currentToken)) logoutCount++;
        });
        await assert.rejects(newClient.pallet.GetDefects());
        assert.equal(logoutCount, 1);
    } finally {
        globalThis.fetch = originalFetch;
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});
