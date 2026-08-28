import test from 'node:test';
import assert from 'node:assert/strict';
import {getErrorMessage} from '../src/lib/errors';

test('getErrorMessage extracts message from standard Error', () => {
    const err = new Error('Paleta o podanym ID już istnieje w bazie danych.');
    assert.equal(getErrorMessage(err, 'Fallback'), 'Paleta o podanym ID już istnieje w bazie danych.');
});

test('getErrorMessage extracts message from string error', () => {
    assert.equal(getErrorMessage('Prosty błąd tekstowy', 'Fallback'), 'Prosty błąd tekstowy');
});

test('getErrorMessage extracts message from object with message property', () => {
    const errObj = {message: 'Błąd z serwera'};
    assert.equal(getErrorMessage(errObj, 'Fallback'), 'Błąd z serwera');
});

test('getErrorMessage extracts error from object with error property', () => {
    const errObj = {error: 'Błąd pola error'};
    assert.equal(getErrorMessage(errObj, 'Fallback'), 'Błąd pola error');
});

test('getErrorMessage falls back when error has no usable message', () => {
    assert.equal(getErrorMessage(null, 'Fallback error'), 'Fallback error');
    assert.equal(getErrorMessage(undefined, 'Fallback error'), 'Fallback error');
    assert.equal(getErrorMessage({}, 'Fallback error'), 'Fallback error');
});
