import assert from 'node:assert/strict';
import {test} from 'node:test';
import ExcelJS from 'exceljs';
import {createReportWorkbook} from '../src/lib/reportWorkbook';
import type {ReportRow} from '../../backend/shared/types';
import {dictionaries} from '../src/i18n/LanguageContext';

test('XLSX roundtrip keeps user text as strings, preserves all rows and formats Warsaw time', async () => {
    const row: ReportRow = {id: 1, pallet_id: '=1+1', project: '+SUM(1,1)', model: '@test', machine: 'COAT',
        previous_status: 'Active', status: 'Damaged', timestamp: '2026-03-29T01:30:00Z',
        defect: 'Other', description: '=HYPERLINK("https://example.com")\nPolskie: ąęść', operator: '-Operator'};
    const rows = Array.from({length: 251}, (_, index) => ({...row, id: index + 1}));
    const blob = await createReportWorkbook(rows, {sheet: 'Historia zdarzeń', headers: ['ID', 'Project', 'Model', 'Machine', 'Previous', 'Status', 'Date', 'Defect', 'Description', 'Operator'], status: value => value, other: 'Inne'});
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await blob.arrayBuffer());
    const sheet = restored.worksheets[0];
    assert.equal(sheet.rowCount, 252);
    assert.equal(sheet.getCell('A2').value, '=1+1');
    assert.equal(sheet.getCell('B2').value, '+SUM(1,1)');
    assert.equal(sheet.getCell('I2').value, row.description);
    assert.equal(sheet.getCell('I2').type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('G2').value, '2026-03-29 03:30:00');
    assert.equal(sheet.getCell('H2').value, 'Inne');
    assert.equal(sheet.getCell('D252').value, 'COAT');
    assert.equal(sheet.views[0].state, 'frozen');
    assert.equal(sheet.views[0].ySplit, 1);
    assert.equal(sheet.getCell('A1').font.bold, true);
    assert.equal(sheet.getCell('A1').fill.type, 'pattern');
    assert.equal(sheet.getCell('I2').alignment.wrapText, true);
    assert.equal(sheet.getColumn(9).width, 65);
    assert.equal(sheet.autoFilter, 'A1:J252');
    for (const cells of [sheet.getRow(2).values, sheet.getRow(252).values]) {
        assert.ok(Array.isArray(cells));
        assert.ok(cells.every(value => typeof value === 'string'));
    }
});

test('new catalog and report translations have matching PL/EN keys', () => {
    const keys = (dictionary: Record<string, string>) => Object.keys(dictionary).filter(key => /^(defect|report|machine|unblock|features_)/.test(key)).sort();
    assert.deepEqual(keys(dictionaries.pl), keys(dictionaries.en));
});
