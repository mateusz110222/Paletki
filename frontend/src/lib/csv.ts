export function escapeCsvCell(value: string | number | undefined | null): string {
    if (value === undefined || value === null) return '""';

    const raw = String(value);
    const neutralized = typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(raw)
        ? `'${raw}`
        : raw;
    return `"${neutralized.replace(/"/g, '""')}"`;
}
