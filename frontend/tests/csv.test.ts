import assert from 'node:assert/strict';
import test from 'node:test';
import {escapeCsvCell} from '../src/lib/csv.ts';

test('escapeCsvCell quotes values and doubles embedded quotes', () => {
    assert.equal(escapeCsvCell('Model "A"'), '"Model ""A"""');
    assert.equal(escapeCsvCell(42), '"42"');
    assert.equal(escapeCsvCell(null), '""');
});

test('escapeCsvCell neutralizes spreadsheet formulas, including leading whitespace', () => {
    assert.equal(escapeCsvCell('=HYPERLINK("https://example.invalid")'), '"\'=HYPERLINK(""https://example.invalid"")"');
    assert.equal(escapeCsvCell('  +SUM(1,2)'), '"\'  +SUM(1,2)"');
    assert.equal(escapeCsvCell('\t@command'), '"\'\t@command"');
});

test('escapeCsvCell keeps ordinary text and numeric negative values unchanged', () => {
    assert.equal(escapeCsvCell('MODEL-1'), '"MODEL-1"');
    assert.equal(escapeCsvCell(-1), '"-1"');
});
