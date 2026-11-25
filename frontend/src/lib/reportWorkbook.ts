import writeExcelFile, {type SheetData, type Feature} from 'write-excel-file/universal';
import type {AuditLog, ReportRow} from '@backend/shared/types';

export interface WorkbookLabels {
    sheet: string; headers: string[]; status: (value: string) => string; other: string;
}

const formatDate = (value: string) => new Date(value).toLocaleString('sv-SE', {timeZone: 'Europe/Warsaw'});

function writeWorkbook(sheet: string, headers: string[], rows: string[][], widths: number[], wrapColumns: number[]): Promise<Blob> {
    const data: SheetData = [headers.map(value => ({value, type: String, fontWeight: 'bold',
        color: '#FFFFFF', backgroundColor: '#172B3A'}))];
    for (const row of rows) {
        // Explicit String cells keep operator input literal, including formula prefixes.
        data.push(row.map((value, index) => ({value, type: String,
            ...(wrapColumns.includes(index) ? {wrap: true, alignVertical: 'top' as const} : {})})));
    }
    // The writer exposes custom XML features; retain Excel's filter controls.
    const lastColumn = String.fromCharCode(64 + widths.length);
    const autoFilter: Feature<Blob> = {files: {transform: {'xl/worksheets/sheet{id}.xml': {
        transform: xml => xml.replace(/<autoFilter\b[^>]*\/>/g, '').replace('</sheetData>',
            `</sheetData><autoFilter ref="A1:${lastColumn}${data.length}"/>`),
    }}}};
    return writeExcelFile(data, {
        sheet: sheet.slice(0, 31), stickyRowsCount: 1,
        columns: widths.map(width => ({width})),
    }, {features: [autoFilter]}).toBlob();
}

export function createReportWorkbook(rows: ReportRow[], labels: WorkbookLabels): Promise<Blob> {
    const values = rows.map(row => [String(row.pallet_id), String(row.project), String(row.model), String(row.machine),
        row.previous_status ? labels.status(row.previous_status) : '', labels.status(row.status), formatDate(row.timestamp),
        row.defect === 'Other' ? labels.other : row.defect ?? '', String(row.description), String(row.operator)]);
    return writeWorkbook(labels.sheet, labels.headers, values, [24, 24, 24, 18, 24, 24, 24, 28, 65, 30], [8]);
}

export function createAuditWorkbook(rows: AuditLog[], labels: Omit<WorkbookLabels, 'other'> & {
    events: Record<NonNullable<AuditLog['event_kind']>, string>;
}): Promise<Blob> {
    const values = rows.map(row => [String(row.id), row.pallet_id, formatDate(row.timestamp), row.operator_id,
        labels.status(row.previous_status), labels.status(row.new_status), row.event_kind ? labels.events[row.event_kind] : '',
        row.description, row.status_reason ?? '', row.comment ?? '']);
    return writeWorkbook(labels.sheet, labels.headers, values, [14, 24, 24, 30, 24, 24, 24, 65, 55, 55], [7, 8, 9]);
}
