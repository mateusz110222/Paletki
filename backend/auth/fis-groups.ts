import {config} from "../config";

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;

interface CachedGroups {
    groups: string[];
    expiresAt: number;
}

const groupCache = new Map<string, CachedGroups>();
const inFlightRequests = new Map<string, Promise<string[]>>();

export function clearFisGroupsCache(): void {
    groupCache.clear();
    inFlightRequests.clear();
}

export function fisNetId(username: string): string {
    const withoutDomain = username.trim().split("\\").pop() ?? "";
    return withoutDomain.split("@")[0].trim();
}

function isUserNotFoundMessage(message: unknown): boolean {
    return typeof message === "string" && /User\s+'[^']*'\s+not\s+found/i.test(message);
}

async function fetchFisGroupsFromRouter(netId: string): Promise<string[]> {
    const response = await fetch(`${config.fis.router1Url}?job=GetUserGroup`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({User: netId}),
        signal: AbortSignal.timeout(config.fis.requestTimeoutMs),
    });

    if (!response.ok) {
        throw new Error(`FIS router HTTP error: ${response.status}`);
    }

    const result: unknown = await response.json();
    if (typeof result !== "object" || result === null || !("status" in result) || typeof result.status !== "boolean") {
        throw new Error("Invalid FIS GetUserGroup response");
    }

    const payload = result as {status: boolean; message?: unknown; data?: unknown};
    if (!payload.status) {
        if (isUserNotFoundMessage(payload.message)) {
            return [];
        }
        throw new Error("FIS GetUserGroup failed");
    }

    if (!Array.isArray(payload.data)) {
        throw new Error("Invalid FIS GetUserGroup data payload");
    }

    const groups = payload.data
        .filter((item): item is string => typeof item === "string")
        .map(group => group.trim())
        .filter(group => /^[A-Za-z0-9_]+$/.test(group));

    return [...new Set(groups)];
}

export async function getFisGroups(username: string): Promise<string[]> {
    const netId = fisNetId(username);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(netId)) {
        throw new Error("Invalid FIS user identifier");
    }

    const cacheKey = netId.toLowerCase();
    const now = Date.now();
    const cached = groupCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return [...cached.groups];
    }

    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
        return [...await inFlight];
    }

    const request = fetchFisGroupsFromRouter(netId)
        .then(groups => {
            if (groupCache.size >= MAX_CACHE_ENTRIES) {
                const oldestKey = groupCache.keys().next().value;
                if (oldestKey !== undefined) groupCache.delete(oldestKey);
            }
            groupCache.set(cacheKey, {
                groups,
                expiresAt: Date.now() + CACHE_TTL_MS,
            });
            return groups;
        })
        .finally(() => {
            inFlightRequests.delete(cacheKey);
        });

    inFlightRequests.set(cacheKey, request);
    return [...await request];
}
