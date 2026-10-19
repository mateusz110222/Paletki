import assert from 'node:assert/strict';
import test from 'node:test';
import {QueryClient} from '@tanstack/react-query';
import {
    ADMIN_COLUMNS_STORAGE_KEY,
    ADMIN_SORT_STORAGE_KEY,
    AUTH_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    SOUND_ENABLED_STORAGE_KEY,
    VOLUME_STORAGE_KEY,
    postBroadcastMessage,
    subscribeBroadcast,
    type BroadcastSyncMessage,
} from '../src/lib/broadcastSync.ts';
import {
    clearStoredSession,
    isSameSession,
    loadStoredSession,
    saveStoredSession,
    subscribeStoredSession,
    type StoredSession,
} from '../src/auth/session.ts';
import {refreshPalletData} from '../src/lib/queryCache.ts';

function createMemoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, String(value));
        },
    };
}

function waitForMessage(
    subscribeOpts: {tabId: string},
    predicate: (msg: BroadcastSyncMessage) => boolean,
): {promise: Promise<BroadcastSyncMessage>; unsubscribe: () => void} {
    let unsubscribe = () => {};
    const promise = new Promise<BroadcastSyncMessage>((resolve) => {
        unsubscribe = subscribeBroadcast((msg) => {
            if (predicate(msg)) {
                unsubscribe();
                resolve(msg);
            }
        }, subscribeOpts);
    });
    return {promise, unsubscribe};
}

const sampleSession: StoredSession = {
    user: {
        FullName: 'Jan Kowalski',
        department: 'IT',
        title: 'Engineer',
        username: 'jkowalski',
        role: 'staff',
        has_it_department_access: true,
        has_ur_department_access: false,
        has_me_department_access: false,
        is_guest: false,
    },
    token: 'tok-palletx-123',
    expiresAt: '2030-01-01T00:00:00.000Z',
};

test('queued session changes converge without writing storage or resurrecting an old session', () => {
    const originals = new Map(['window', 'localStorage', 'BroadcastChannel'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)],
    ));
    const tabs = ['a', 'b'];
    let activeTab = 'a';
    const handlers = new Map<string, (event: StorageEvent) => void>();
    const states = new Map<string, StoredSession | null>();
    const queue: {tab: string; key: string; newValue: string | null}[] = [];
    const storage = createMemoryStorage();
    let writes = 0;
    const enqueue = (key: string, newValue: string | null) => {
        for (const tab of tabs) {
            if (tab !== activeTab) queue.push({tab, key, newValue});
        }
    };
    Object.defineProperty(globalThis, 'BroadcastChannel', {configurable: true, value: undefined});
    Object.defineProperty(globalThis, 'window', {configurable: true, value: {
        addEventListener: (_type: string, handler: (event: StorageEvent) => void) => handlers.set(activeTab, handler),
        removeEventListener: () => {},
    }});
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
        getItem: (key: string) => storage.getItem(key),
        setItem: (key: string, value: string) => {
            writes++;
            if (storage.getItem(key) === value) return;
            storage.setItem(key, value);
            enqueue(key, value);
        },
        removeItem: (key: string) => {
            writes++;
            if (storage.getItem(key) === null) return;
            storage.removeItem(key);
            enqueue(key, null);
        },
    }});
    const cleanups: (() => void)[] = [];
    const drain = () => {
        let processed = 0;
        while (queue.length && processed++ < 20) {
            const event = queue.shift()!;
            activeTab = event.tab;
            handlers.get(activeTab)!(event as unknown as StorageEvent);
        }
        assert.equal(queue.length, 0, 'receiving session events must not generate more storage events');
    };
    try {
        for (const tab of tabs) {
            activeTab = tab;
            cleanups.push(subscribeStoredSession(session => states.set(tab, session)));
        }
        activeTab = 'a';
        saveStoredSession(sampleSession);
        clearStoredSession();
        drain();
        assert.equal(states.get('b'), null);
        assert.equal(storage.getItem(AUTH_STORAGE_KEY), null);
        assert.equal(writes, 2);

        activeTab = 'a';
        saveStoredSession(sampleSession);
        clearStoredSession();
        const newest = {...sampleSession, token: 'new-session'};
        saveStoredSession(newest);
        drain();
        assert.deepEqual(states.get('b'), newest);
        assert.deepEqual(JSON.parse(storage.getItem(AUTH_STORAGE_KEY)!), newest);
        assert.equal(writes, 5);
    } finally {
        cleanups.forEach(cleanup => cleanup());
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
});

test('clicking logout broadcasts auth:logout to all other open windows and clears stored session', async () => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: createMemoryStorage()});

    const otherWindow = waitForMessage({tabId: 'window-2'}, msg => msg.type === 'auth:logout');
    const sameWindowMessages: BroadcastSyncMessage[] = [];
    const unsubscribeSameWindow = subscribeBroadcast((msg) => {
        sameWindowMessages.push(msg);
    });

    try {
        saveStoredSession(sampleSession, {broadcast: false});
        assert.ok(isSameSession(loadStoredSession(), sampleSession));

        clearStoredSession();

        const received = await otherWindow.promise;
        assert.equal(received.type, 'auth:logout');
        assert.equal(loadStoredSession(), null);
        assert.equal(globalThis.localStorage.getItem(AUTH_STORAGE_KEY), null);
        assert.equal(sameWindowMessages.length, 0);
    } finally {
        otherWindow.unsubscribe();
        unsubscribeSameWindow();
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});

test('logging in broadcasts auth:session to other open windows', async () => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: createMemoryStorage()});

    const otherWindow = waitForMessage({tabId: 'window-2'}, msg => msg.type === 'auth:session');

    try {
        saveStoredSession(sampleSession);

        const received = await otherWindow.promise;
        assert.equal(received.type, 'auth:session');
        if (received.type === 'auth:session') {
            assert.ok(isSameSession(received.session, sampleSession));
        }
    } finally {
        otherWindow.unsubscribe();
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});

test('expired sessions automatically broadcast auth:logout when checked', async () => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: createMemoryStorage()});

    const otherWindow = waitForMessage({tabId: 'window-2'}, msg => msg.type === 'auth:logout');

    try {
        globalThis.localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
                ...sampleSession,
                expiresAt: new Date(Date.now() - 60_000).toISOString(),
            }),
        );

        const loaded = loadStoredSession({broadcastOnExpire: true});
        assert.equal(loaded, null);
        assert.equal(globalThis.localStorage.getItem(AUTH_STORAGE_KEY), null);

        const received = await otherWindow.promise;
        assert.equal(received.type, 'auth:logout');
    } finally {
        otherWindow.unsubscribe();
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});

test('refreshPalletData broadcasts query:invalidate across windows', async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const otherWindow = waitForMessage({tabId: 'window-2'}, msg => msg.type === 'query:invalidate');

    try {
        await refreshPalletData(client);
        const received = await otherWindow.promise;
        assert.equal(received.type, 'query:invalidate');
        if (received.type === 'query:invalidate') {
            assert.deepEqual(received.queryKeys, [
                ['pallets'],
                ['operator-reports'],
                ['reports'],
                ['public-dashboard'],
            ]);
        }
    } finally {
        otherWindow.unsubscribe();
        client.clear();
    }
});

test('storage events act as fallback for cross-window logout, language, audio, and table preferences', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const listeners = new Map<string, Set<(event: StorageEvent) => void>>();

    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            addEventListener: (type: string, handler: (event: StorageEvent) => void) => {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type)!.add(handler);
            },
            removeEventListener: (type: string, handler: (event: StorageEvent) => void) => {
                listeners.get(type)?.delete(handler);
            },
        },
    });

    const received: BroadcastSyncMessage[] = [];
    const unsubscribe = subscribeBroadcast((msg) => {
        received.push(msg);
    }, {tabId: 'window-storage'});

    const emitStorage = (key: string | null, newValue: string | null) => {
        for (const handler of listeners.get('storage') ?? []) {
            handler({key, newValue} as StorageEvent);
        }
    };

    try {
        emitStorage(AUTH_STORAGE_KEY, null);
        emitStorage(LANGUAGE_STORAGE_KEY, 'en');
        emitStorage(SOUND_ENABLED_STORAGE_KEY, 'false');
        emitStorage(VOLUME_STORAGE_KEY, 'loud');
        emitStorage(ADMIN_SORT_STORAGE_KEY, JSON.stringify({key: 'status', direction: 'desc'}));
        emitStorage(ADMIN_COLUMNS_STORAGE_KEY, JSON.stringify(['project', 'fis']));
        postBroadcastMessage({type: 'lang:change', language: 'pl'}, {senderId: 'window-storage'});

        assert.deepEqual(received, [
            {type: 'auth:logout'},
            {type: 'lang:change', language: 'en'},
            {type: 'audio:preferences', soundEnabled: false},
            {type: 'audio:preferences', volumeLevel: 'loud'},
            {type: 'table:preferences', sort: {key: 'status', direction: 'desc'}},
            {type: 'table:preferences', hiddenColumns: ['project', 'fis']},
        ]);
    } finally {
        unsubscribe();
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});
