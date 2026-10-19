import assert from 'node:assert/strict';
import test from 'node:test';
import {QueryClient, QueryObserver} from '@tanstack/react-query';
import {syncSessionQueries} from '../src/lib/queryCache.ts';

test('session refresh replaces an in-flight old request using the updated query function', async () => {
    const cache = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const calls: string[] = [];
    let finishOld!: (value: string) => void;
    const observer = new QueryObserver(cache, {
        queryKey: ['reports'],
        staleTime: Infinity,
        queryFn: () => {
            calls.push('old-token');
            return new Promise<string>(resolve => { finishOld = resolve; });
        },
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
        // React Query installs these options after the new client is rendered.
        observer.setOptions({
            queryKey: ['reports'],
            staleTime: Infinity,
            queryFn: async () => { calls.push('new-token'); return 'new-data'; },
        });
        await syncSessionQueries(cache, true);
        assert.deepEqual(calls, ['old-token', 'new-token']);
        assert.equal(cache.getQueryData(['reports']), 'new-data');
        finishOld('old-data');
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(cache.getQueryData(['reports']), 'new-data');
    } finally {
        unsubscribe();
        cache.clear();
    }
});

test('logout clears private queries while preserving an in-flight public dashboard', async () => {
    const cache = new QueryClient();
    cache.setQueryData(['reports'], ['private']);
    cache.setQueryData(['pallets', 'pl'], ['private']);
    cache.setQueryData(['public-projects'], ['public']);
    let finishDashboard!: (value: string) => void;
    const dashboard = cache.fetchQuery({
        queryKey: ['public-dashboard', null],
        queryFn: () => new Promise<string>(resolve => { finishDashboard = resolve; }),
    });
    try {
        await syncSessionQueries(cache, false);
        assert.equal(cache.getQueryData(['reports']), undefined);
        assert.equal(cache.getQueryData(['pallets', 'pl']), undefined);
        assert.deepEqual(cache.getQueryData(['public-projects']), ['public']);
        finishDashboard('public-data');
        await dashboard;
        assert.equal(cache.getQueryData(['public-dashboard', null]), 'public-data');
    } finally {
        cache.clear();
    }
});
