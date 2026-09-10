import React, { useEffect, useRef, useState } from 'react';

import type { DirectoryUser } from '@backend/shared/types';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';

import { getErrorMessage } from '../lib/errors';

export function useDirectoryView() {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const [netId, setNetId] = useState('');
    const [result, setResult] = useState<DirectoryUser | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const requestRef = useRef<AbortController | null>(null);
    useEffect(() => () => requestRef.current?.abort(), []);

    async function search(event: React.SyntheticEvent<HTMLFormElement>) {
        event.preventDefault();
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setResult(null);
        setError('');
        try {
            const requestApi = apiClient.with({
                fetcher: (input, init) => fetch(input, {...init, signal: controller.signal}),
            });
            const data = await requestApi.auth.LookupDirectoryUser({
                net_id: netId.trim(),
                acceptLanguage: language,
            });
            if (controller.signal.aborted) return;
            setResult(data as DirectoryUser);
        } catch (err: unknown) {
            if (!controller.signal.aborted) setError(getErrorMessage(err, t('directory_error')));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }

    const canSearch = !loading && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(netId.trim());
    return {canSearch, t, netId, setNetId, result, error, loading, search};
}
