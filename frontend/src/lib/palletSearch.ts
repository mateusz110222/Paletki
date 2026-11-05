import type {Pallet} from '@backend/shared/types';

export function matchesPalletSearch(
    pallet: {pallet_id?: string; project?: string; model?: string; created_by?: string},
    search: string,
): boolean {
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const query = normalize(search);
    return [pallet.pallet_id, pallet.project, pallet.model, pallet.created_by]
        .some(value => normalize(value ?? '').includes(query));
}

export function filterPallets(
    pallets: readonly Pallet[],
    filters: {search: string; project: string; model: string; status: string; machine: string; fis: string},
): Pallet[] {
    return pallets.filter(pallet => matchesPalletSearch(pallet, filters.search)
        && (filters.project === 'ALL' || pallet.project === filters.project)
        && (filters.model === 'ALL' || pallet.model === filters.model)
        && (filters.status === 'ALL' || pallet.status === filters.status)
        && (filters.machine === 'ALL' || pallet.machine === filters.machine)
        && (filters.fis === 'ALL' || String(pallet.fis) === filters.fis));
}
