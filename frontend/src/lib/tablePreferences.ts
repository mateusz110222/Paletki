import type {Pallet} from '@backend/shared/types';
export const SORT_KEYS = ['pallet_id', 'project', 'model', 'fis', 'current_cycles', 'status', 'created_by'] as const;
export type SortKey = typeof SORT_KEYS[number];
export type TableSort = {key: SortKey; direction: 'asc' | 'desc'};
export const OPTIONAL_COLUMNS = ['project', 'model', 'fis', 'current_cycles', 'status', 'created_by'] as const;
export type OptionalColumn = typeof OPTIONAL_COLUMNS[number];
export function parseTableSort(raw: string | null): TableSort {
    try {
        const value = JSON.parse(raw ?? 'null');
        if (value && SORT_KEYS.includes(value.key) && ['asc', 'desc'].includes(value.direction)) return {key: value.key, direction: value.direction};
    } catch { /* Use defaults for corrupted preferences. */ }
    return {key: 'pallet_id', direction: 'asc'};
}
export function readPreference(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
}
export function savePreference(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
export function readHiddenColumns(): OptionalColumn[] {
    try {
        const value: unknown = JSON.parse(readPreference('palletx.admin.columns') ?? '[]');
        return Array.isArray(value) ? OPTIONAL_COLUMNS.filter(key => value.includes(key)) : [];
    } catch { return []; }
}
export function sortPallets(pallets: Pallet[], sort: TableSort, locale: string) {
    const compare = new Intl.Collator(locale, {numeric: true, sensitivity: 'base'});
    return [...pallets].sort((a, b) => {
        const left = a[sort.key], right = b[sort.key];
        const difference = typeof left === 'number' && typeof right === 'number'
            ? left - right : compare.compare(String(left ?? ''), String(right ?? ''));
        return difference * (sort.direction === 'asc' ? 1 : -1) || compare.compare(a.pallet_id, b.pallet_id);
    });
}
