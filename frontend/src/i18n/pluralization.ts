import {Language} from './LanguageContext';

/**
 * Polish grammatical pluralization rules for countable nouns:
 * - 1: one (np. 1 paleta, 1 projekt)
 * - 2-4, 22-24, 32-34...: few (np. 2 palety, 3 projekty)
 * - 0, 5-21, 25-31...: many (np. 5 palet, 10 projektów)
 */
export function pluralizePL(count: number, one: string, few: string, many: string, includeNumber = true): string {
    const abs = Math.abs(count);
    let word = many;
    if (abs === 1) {
        word = one;
    } else {
        const mod10 = abs % 10;
        const mod100 = abs % 100;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
            word = few;
        }
    }
    return includeNumber ? `${count} ${word}` : word;
}

export function pluralizeEN(count: number, singular: string, plural: string, includeNumber = true): string {
    const word = Math.abs(count) === 1 ? singular : plural;
    return includeNumber ? `${count} ${word}` : word;
}

export function formatProjectsCount(count: number, language: Language, includeNumber = true): string {
    if (language === 'pl') {
        return pluralizePL(count, 'aktywny projekt', 'aktywne projekty', 'aktywnych projektów', includeNumber);
    }
    return pluralizeEN(count, 'active project', 'active projects', includeNumber);
}

export function formatPalletsCount(count: number, language: Language, includeNumber = true): string {
    if (language === 'pl') {
        return pluralizePL(count, 'paleta', 'palety', 'palet', includeNumber);
    }
    return pluralizeEN(count, 'pallet', 'pallets', includeNumber);
}

export function formatRegisteredPallets(count: number, language: Language, includeNumber = true): string {
    if (language === 'pl') {
        return pluralizePL(count, 'zarejestrowana paleta', 'zarejestrowane palety', 'zarejestrowanych palet', includeNumber);
    }
    return pluralizeEN(count, 'registered pallet', 'registered pallets', includeNumber);
}

export function formatAvailablePallets(count: number, language: Language, includeNumber = true): string {
    if (language === 'pl') {
        return pluralizePL(count, 'dostępna paleta', 'dostępne palety', 'dostępnych palet', includeNumber);
    }
    return pluralizeEN(count, 'available pallet', 'available pallets', includeNumber);
}

export function formatHistoryEntries(count: number, language: Language, includeNumber = true): string {
    if (language === 'pl') {
        return pluralizePL(count, 'wpis audytu', 'wpisy audytu', 'wpisów audytu', includeNumber);
    }
    return pluralizeEN(count, 'audit entry', 'audit entries', includeNumber);
}

export function formatOperatorsCount(count: number, language: Language, includeNumber = true): string {
    if (language === 'pl') {
        return pluralizePL(count, 'operator', 'operatorzy', 'operatorów', includeNumber);
    }
    return pluralizeEN(count, 'operator', 'operators', includeNumber);
}
