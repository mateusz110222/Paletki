import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
    formatAvailablePallets,
    formatHistoryEntries,
    formatOperatorsCount,
    formatPalletsCount,
    formatProjectsCount,
    formatRegisteredPallets,
    pluralizeEN,
    pluralizePL,
} from '../src/i18n/pluralization.ts';

test('pluralizePL formats Polish numerals correctly', () => {
    assert.equal(pluralizePL(1, 'projekt', 'projekty', 'projektów'), '1 projekt');
    assert.equal(pluralizePL(2, 'projekt', 'projekty', 'projektów'), '2 projekty');
    assert.equal(pluralizePL(4, 'projekt', 'projekty', 'projektów'), '4 projekty');
    assert.equal(pluralizePL(5, 'projekt', 'projekty', 'projektów'), '5 projektów');
    assert.equal(pluralizePL(12, 'projekt', 'projekty', 'projektów'), '12 projektów');
    assert.equal(pluralizePL(21, 'projekt', 'projekty', 'projektów'), '21 projektów');
    assert.equal(pluralizePL(22, 'projekt', 'projekty', 'projektów'), '22 projekty');
    assert.equal(pluralizePL(25, 'projekt', 'projekty', 'projektów'), '25 projektów');
    assert.equal(pluralizePL(0, 'projekt', 'projekty', 'projektów'), '0 projektów');
});

test('pluralizeEN formats English numerals correctly', () => {
    assert.equal(pluralizeEN(1, 'project', 'projects'), '1 project');
    assert.equal(pluralizeEN(2, 'project', 'projects'), '2 projects');
    assert.equal(pluralizeEN(0, 'project', 'projects'), '0 projects');
});

test('formatProjectsCount works for Polish and English', () => {
    assert.equal(formatProjectsCount(1, 'pl'), '1 aktywny projekt');
    assert.equal(formatProjectsCount(2, 'pl'), '2 aktywne projekty');
    assert.equal(formatProjectsCount(5, 'pl'), '5 aktywnych projektów');
    assert.equal(formatProjectsCount(1, 'en'), '1 active project');
    assert.equal(formatProjectsCount(2, 'en'), '2 active projects');
});

test('formatPalletsCount and formatAvailablePallets work properly', () => {
    assert.equal(formatPalletsCount(1, 'pl'), '1 paleta');
    assert.equal(formatPalletsCount(3, 'pl'), '3 palety');
    assert.equal(formatPalletsCount(10, 'pl'), '10 palet');
    assert.equal(formatAvailablePallets(1, 'pl'), '1 dostępna paleta');
    assert.equal(formatAvailablePallets(2, 'pl'), '2 dostępne palety');
    assert.equal(formatAvailablePallets(5, 'pl'), '5 dostępnych palet');
});

test('formatHistoryEntries, formatOperatorsCount and formatRegisteredPallets work properly', () => {
    assert.equal(formatHistoryEntries(1, 'pl'), '1 wpis audytu');
    assert.equal(formatHistoryEntries(2, 'pl'), '2 wpisy audytu');
    assert.equal(formatHistoryEntries(5, 'pl'), '5 wpisów audytu');

    assert.equal(formatOperatorsCount(1, 'pl'), '1 operator');
    assert.equal(formatOperatorsCount(2, 'pl'), '2 operatorzy');
    assert.equal(formatOperatorsCount(5, 'pl'), '5 operatorów');

    assert.equal(formatRegisteredPallets(1, 'pl'), '1 zarejestrowana paleta');
    assert.equal(formatRegisteredPallets(2, 'pl'), '2 zarejestrowane palety');
    assert.equal(formatRegisteredPallets(5, 'pl'), '5 zarejestrowanych palet');
});

