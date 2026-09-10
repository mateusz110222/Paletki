export function matchesPalletSearch(
    pallet: {pallet_id?: string; project?: string; model?: string; created_by?: string},
    search: string,
): boolean {
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const query = normalize(search);
    return [pallet.pallet_id, pallet.project, pallet.model, pallet.created_by]
        .some(value => normalize(value ?? '').includes(query));
}
