interface ImportMetaWithFisEnv extends ImportMeta {
    readonly env?: {
        readonly FIS1_UNIT_HISTORY_URL?: string;
        readonly FIS2_UNIT_HISTORY_URL?: string;
    };
}

const env = (import.meta as ImportMetaWithFisEnv).env;

const unitHistoryUrls: Readonly<Record<number, string | undefined>> = {
    1: env?.FIS1_UNIT_HISTORY_URL,
    2: env?.FIS2_UNIT_HISTORY_URL,
};

export function getFisUnitHistoryUrl(fis: number, palletId: string): string | null {
    const baseUrl = unitHistoryUrls[fis]?.trim();
    if (!baseUrl || !palletId) return null;

    try {
        const url = new URL(baseUrl);
        url.searchParams.set('unit', palletId);
        return url.toString();
    } catch {
        console.error(`Invalid FIS${fis}_UNIT_HISTORY_URL configuration.`);
        return null;
    }
}
