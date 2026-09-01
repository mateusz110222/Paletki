import assert from 'node:assert/strict';
import test from 'node:test';
import {parseStoredSession} from '../src/auth/session.ts';

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
