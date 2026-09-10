/** Load every cursor page before publishing a complete inventory to the cache. */
export async function loadPalletPages<T>(
    fetchPage: (afterId: number | undefined) => Promise<{
        pallets: T[];
        next_cursor?: number | null;
    }>,
): Promise<T[]> {
    const pallets: T[] = [];
    let afterId: number | undefined;

    while (true) {
        const page = await fetchPage(afterId);
        pallets.push(...page.pallets);

        if (page.next_cursor == null) return pallets;

        if (!Number.isSafeInteger(page.next_cursor) || page.next_cursor <= (afterId ?? 0)) {
            throw new Error('Invalid pallet pagination cursor');
        }

        afterId = page.next_cursor;
    }
}
