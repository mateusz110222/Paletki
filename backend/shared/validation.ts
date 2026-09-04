import type {Max, MaxLen, Min, MinLen, MatchesRegexp} from "encore.dev/validate";
import {PALLET_STATUSES, type PalletStatus} from "./types";

export type PalletID = string
    & MinLen<1>
    & MaxLen<50>
    & MatchesRegexp<"^[A-Za-z0-9._-]+$">;

export type ShortText = string & MinLen<1> & MaxLen<50>;
export type AuditReason = string & MinLen<1> & MaxLen<1_000>;
export type MaxCycles = number & Min<1> & Max<1_000_000>;
export type NestCount = number & Min<1> & Max<10_000>;
export type FisUnit = 1 | 2;

export function normalizePalletId(value: string): string {
    return value.trim().toUpperCase();
}

export function normalizeStation(value: string): string {
    return value.trim().toUpperCase();
}

/** Expands IDs whose final two characters are the pallet sequence number. */
export function expandPalletRange(firstValue: string, lastValue: string): string[] | null {
    const first = normalizePalletId(firstValue);
    const last = normalizePalletId(lastValue);
    const firstMatch = /^(.*?)(\d{2})$/.exec(first);
    const lastMatch = /^(.*?)(\d{2})$/.exec(last);
    if (!firstMatch || !lastMatch || !firstMatch[1] || firstMatch[1] !== lastMatch[1]) return null;

    const start = Number(firstMatch[2]);
    const end = Number(lastMatch[2]);
    if (start > end) return null;

    return Array.from(
        {length: end - start + 1},
        (_, index) => `${firstMatch[1]}${String(start + index).padStart(2, "0")}`,
    );
}

export function normalizePalletStatus(value: string): PalletStatus | null {
    const normalized = value.trim().toLocaleLowerCase("en-US");
    return PALLET_STATUSES.find(
        (status) => status.toLocaleLowerCase("en-US") === normalized,
    ) ?? null;
}

export function isSafePositiveInteger(value: number): boolean {
    return Number.isSafeInteger(value) && value > 0;
}

export function isFisSafeText(value: string): boolean {
    return [...value].every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return character !== "|" && codePoint > 31 && codePoint !== 127;
    });
}
