import type {QueryClient} from '@tanstack/react-query';
import {postBroadcastMessage} from './broadcastSync.ts';

export const syncSessionQueries = (queryClient: QueryClient, isAuthenticated: boolean) => {
    const filters = isAuthenticated ? {} : {
        predicate: (query: {queryKey: readonly unknown[]}) =>
            query.queryKey[0] !== 'public-dashboard' && query.queryKey[0] !== 'public-projects',
    };
    // Cancel requests from the previous session before starting fresh ones.
    void queryClient.cancelQueries(filters);
    if (isAuthenticated) return queryClient.invalidateQueries();
    queryClient.removeQueries(filters);
};

export const invalidateAndBroadcast = (
    queryClient: QueryClient,
    queryKeys: readonly (readonly unknown[])[],
) => {
    postBroadcastMessage({type: 'query:invalidate', queryKeys});
    return Promise.all(
        queryKeys.map(queryKey => queryClient.invalidateQueries({queryKey})),
    );
};

export const refreshPalletData = (
    queryClient: QueryClient,
    extraKeys: readonly (readonly unknown[])[] = [],
) => invalidateAndBroadcast(queryClient, [
    ['pallets'],
    ['operator-reports'],
    ['reports'],
    ['public-dashboard'],
    ...extraKeys,
]);
