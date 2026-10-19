import {AUTH_STORAGE_KEY, parseStoredSession, type StoredSession} from '../auth/session.ts';
import type {Language} from '../i18n/LanguageContext.tsx';
import type {AudioVolumeLevel} from './audio.ts';
import type {OptionalColumn, SortKey, TableSort} from './tablePreferences.ts';

export const BROADCAST_CHANNEL_NAME = 'palletx_sync';
export const LANGUAGE_STORAGE_KEY = 'palletx.language';
export const SOUND_ENABLED_STORAGE_KEY = 'palletx.scan-sound';
export const VOLUME_STORAGE_KEY = 'palletx.scan-volume';
export const ADMIN_SORT_STORAGE_KEY = 'palletx.admin.sort';
export const ADMIN_COLUMNS_STORAGE_KEY = 'palletx.admin.columns';

export {AUTH_STORAGE_KEY};

const VALID_SORT_KEYS: readonly SortKey[] = [
    'pallet_id',
    'project',
    'model',
    'fis',
    'current_cycles',
    'status',
    'created_by',
    'created_at',
];

const VALID_OPTIONAL_COLUMNS: readonly OptionalColumn[] = [
    'project',
    'model',
    'fis',
    'current_cycles',
    'status',
    'created_by',
    'created_at',
];

export type BroadcastSyncPayload =
    | {type: 'auth:logout'}
    | {type: 'auth:session'; session: StoredSession}
    | {type: 'query:invalidate'; queryKeys: readonly (readonly unknown[])[]}
    | {type: 'lang:change'; language: Language}
    | {type: 'audio:preferences'; soundEnabled?: boolean; volumeLevel?: AudioVolumeLevel}
    | {type: 'table:preferences'; sort?: TableSort; hiddenColumns?: OptionalColumn[]};

export type BroadcastSyncMessage = BroadcastSyncPayload & {
    senderId?: string;
    timestamp?: number;
};

const TAB_ID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function getTabId(): string {
    return TAB_ID;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isValidVolumeLevel(value: unknown): value is AudioVolumeLevel {
    return value === 'low' || value === 'normal' || value === 'loud';
}

function isValidTableSort(value: unknown): value is TableSort {
    return (
        isRecord(value) &&
        typeof value.key === 'string' &&
        VALID_SORT_KEYS.includes(value.key as SortKey) &&
        (value.direction === 'asc' || value.direction === 'desc')
    );
}

function isValidHiddenColumns(value: unknown): value is OptionalColumn[] {
    return (
        Array.isArray(value) &&
        value.every(col => typeof col === 'string' && VALID_OPTIONAL_COLUMNS.includes(col as OptionalColumn))
    );
}

export function isValidBroadcastMessage(value: unknown): value is BroadcastSyncMessage {
    if (!isRecord(value) || typeof value.type !== 'string') return false;
    switch (value.type) {
        case 'auth:logout':
            return true;
        case 'auth:session':
            if (!isRecord(value.session)) return false;
            try {
                return parseStoredSession(JSON.stringify(value.session)) !== null;
            } catch {
                return false;
            }
        case 'query:invalidate':
            return Array.isArray(value.queryKeys) && value.queryKeys.every(Array.isArray);
        case 'lang:change':
            return value.language === 'pl' || value.language === 'en';
        case 'audio:preferences':
            return (
                (value.soundEnabled === undefined || typeof value.soundEnabled === 'boolean') &&
                (value.volumeLevel === undefined || isValidVolumeLevel(value.volumeLevel)) &&
                (value.soundEnabled !== undefined || value.volumeLevel !== undefined)
            );
        case 'table:preferences':
            return (
                (value.sort === undefined || isValidTableSort(value.sort)) &&
                (value.hiddenColumns === undefined || isValidHiddenColumns(value.hiddenColumns)) &&
                (value.sort !== undefined || value.hiddenColumns !== undefined)
            );
        default:
            return false;
    }
}

export function postBroadcastMessage(
    payload: BroadcastSyncPayload,
    options?: {senderId?: string},
): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
        const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        const message: BroadcastSyncMessage = {
            ...payload,
            senderId: options?.senderId ?? TAB_ID,
            timestamp: Date.now(),
        };
        channel.postMessage(message);
        channel.close();
    } catch {
        // Ignore BroadcastChannel errors in restricted environments
    }
}

export function subscribeBroadcast(
    listener: (message: BroadcastSyncMessage) => void,
    options?: {tabId?: string; listenStorage?: boolean},
): () => void {
    const currentTabId = options?.tabId ?? TAB_ID;
    const listenStorage = options?.listenStorage ?? true;
    let channel: BroadcastChannel | null = null;

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
            channel.onmessage = (event: MessageEvent<unknown>) => {
                if (!isValidBroadcastMessage(event.data)) return;
                if (event.data.senderId && event.data.senderId === currentTabId) return;
                listener(event.data);
            };
        } catch {
            channel = null;
        }
    }

    const canListenStorage = listenStorage
        && typeof window !== 'undefined'
        && typeof window.addEventListener === 'function';

    const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === AUTH_STORAGE_KEY) {
            if (!event.newValue) {
                listener({type: 'auth:logout'});
                return;
            }
            const parsed = parseStoredSession(event.newValue);
            if (parsed) {
                listener({type: 'auth:session', session: parsed});
            } else {
                listener({type: 'auth:logout'});
            }
            return;
        }

        if (event.key === LANGUAGE_STORAGE_KEY && (event.newValue === 'pl' || event.newValue === 'en')) {
            listener({type: 'lang:change', language: event.newValue});
            return;
        }

        if (event.key === SOUND_ENABLED_STORAGE_KEY) {
            listener({type: 'audio:preferences', soundEnabled: event.newValue !== 'false'});
            return;
        }

        if (event.key === VOLUME_STORAGE_KEY && isValidVolumeLevel(event.newValue)) {
            listener({type: 'audio:preferences', volumeLevel: event.newValue});
            return;
        }

        if (event.key === ADMIN_SORT_STORAGE_KEY) {
            try {
                const parsed: unknown = JSON.parse(event.newValue ?? 'null');
                if (isValidTableSort(parsed)) {
                    listener({type: 'table:preferences', sort: parsed});
                } else {
                    listener({type: 'table:preferences', sort: {key: 'pallet_id', direction: 'asc'}});
                }
            } catch {
                listener({type: 'table:preferences', sort: {key: 'pallet_id', direction: 'asc'}});
            }
            return;
        }

        if (event.key === ADMIN_COLUMNS_STORAGE_KEY) {
            try {
                const parsed: unknown = JSON.parse(event.newValue ?? '[]');
                if (Array.isArray(parsed)) {
                    const filtered = VALID_OPTIONAL_COLUMNS.filter(col => parsed.includes(col));
                    listener({type: 'table:preferences', hiddenColumns: filtered});
                }
            } catch {
                listener({type: 'table:preferences', hiddenColumns: []});
            }
        }
    };

    if (canListenStorage) {
        window.addEventListener('storage', onStorage);
    }

    return () => {
        if (channel) {
            try {
                channel.onmessage = null;
                channel.close();
            } catch {
                // Ignore close errors
            }
            channel = null;
        }
        if (canListenStorage && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('storage', onStorage);
        }
    };
}
