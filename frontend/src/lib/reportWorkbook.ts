import writeExcelFile, {type SheetData, type Feature} from 'write-excel-file/universal';
import type {ReportRow} from '@backend/shared/types';

export interface WorkbookLabels {
    sheet: string; headers: string[]; status: (value: string) => string; other: string;
}

export async function createReportWorkbook(rows: ReportRow[], labels: WorkbookLabels): Promise<Blob> {
    const data: SheetData = [labels.headers.map(value => ({value, type: String, fontWeight: 'bold',
        color: '#FFFFFF', backgroundColor: '#172B3A'}))];
    for (const row of rows) {
        const values = [String(row.pallet_id), String(row.project), String(row.model), String(row.machine),
            row.previous_status ? labels.status(row.previous_status) : '', labels.status(row.status),
            new Date(row.timestamp).toLocaleString('sv-SE', {timeZone: 'Europe/Warsaw'}),
            row.defect === 'Other' ? labels.other : row.defect ?? '', String(row.description), String(row.operator)];
        // Explicit String cells keep operator input literal, including formula prefixes.
        data.push(values.map((value, index) => ({value, type: String,
            ...(index === 8 ? {wrap: true, alignVertical: 'top' as const} : {})})));
    }
    // The writer exposes custom XML features; retain Excel's filter controls.
    // This report has a fixed ten-column layout and no optional worksheet features.
    const autoFilter: Feature<Blob> = {files: {transform: {'xl/worksheets/sheet{id}.xml': {
        transform: xml => xml.replace(/<autoFilter\b[^>]*\/>/g, '').replace('</sheetData>',
            `</sheetData><autoFilter ref="A1:J${data.length}"/>`),
    }}}};
    return writeExcelFile(data, {
        sheet: labels.sheet.slice(0, 31), stickyRowsCount: 1,
        columns: [24, 24, 24, 18, 24, 24, 24, 28, 65, 30].map(width => ({width})),
    }, {features: [autoFilter]}).toBlob();
}
