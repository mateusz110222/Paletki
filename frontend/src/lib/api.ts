import Client, {shared} from "./client";
import {API_BASE_URL} from "@backend/shared/API_BASE_URL";
import {
    PALLET_STATUSES,
    type LoginResponse,
    type Pallet,
    type PublicDashboardResponse,
    type UserData,
} from "@backend/shared/types";

const target = API_BASE_URL || window.location.origin;

export const publicApi = new Client(target);

export async function getPublicDashboard(station?: string, signal?: AbortSignal): Promise<PublicDashboardResponse> {
    const url = new URL(`${target.replace(/\/$/, '')}/public/dashboard`);
    if (station) url.searchParams.set('station', station);
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error(`Dashboard request failed with status ${response.status}`);
    return await response.json() as PublicDashboardResponse;
}

export function asPallet(value: shared.Pallet): Pallet {
    if (!value.status || !PALLET_STATUSES.includes(value.status) || (value.fis !== 1 && value.fis !== 2)) {
        throw new Error(`API returned an invalid pallet contract for ${value.pallet_id}`);
    }
    return {...value, status: value.status, fis: value.fis};
}

export function authenticatedApi(
    token: string | undefined,
    language: string,
    onUnauthorized?: () => void,
): Client {
    return new Client(target, {
        auth: () => ({
            authorization: token ? `Bearer ${token}` : undefined,
            acceptLanguage: language,
        }),
        fetcher: async (input, init) => {
            const response = await fetch(input, init);
            if (response.status === 401) onUnauthorized?.();
            return response;
        },
    });
}

export function asLoginResponse(value: shared.LoginResponse): LoginResponse {
    // Keep the frontend compatible with an older backend image which returned
    // the expiry field in camelCase. New generated clients use expires_at.
    const runtimeValue = value as shared.LoginResponse & {expiresAt?: unknown};
    const expiresAt = value.expires_at ?? runtimeValue.expiresAt;
    if (
        value.status !== true ||
        !value.data ||
        typeof value.token !== 'string' ||
        value.token.length === 0 ||
        typeof expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(expiresAt))
    ) {
        throw new Error('API returned an invalid login session');
    }

    return {
        status: true,
        message: value.message,
        data: value.data as UserData,
        token: value.token,
        expires_at: expiresAt,
    };
}
