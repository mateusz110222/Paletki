import React, { useEffect, useRef, useState } from 'react';

import { useTranslation } from '../i18n/LanguageContext';
import { useAuth } from '../auth/AuthContext';
import { useDocumentMetadata } from '../hooks/useDocumentMetadata.ts';
import { subscribeBroadcast } from '../lib/broadcastSync.ts';
import { getErrorMessage } from '../lib/errors';

export function useLoginView() {
    const {t, language} = useTranslation();
    const {login, loginWithCard} = useAuth();

    const cardLoginPending = useRef(false);
    const cardInputRef = useRef<HTMLInputElement>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showOperatorSession, setShowOperatorSession] = useState(false);
    const [operatorIdentifier, setOperatorIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (showOperatorSession && !loading) cardInputRef.current?.focus();
    }, [showOperatorSession, loading]);

    useDocumentMetadata(
        `PalletX | ${t('login_title')}`,
        t('app_meta_description'),
        language,
    );

    useEffect(() => {
        return subscribeBroadcast((message) => {
            if (message.type === 'auth:logout' || message.type === 'auth:session') {
                setErrorMessage(null);
                setPassword('');
            }
        });
    }, []);

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!username.trim() || !password) return;

        setLoading(true);
        setErrorMessage(null);

        try {
            const result = await login(username.trim(), password);
            setPassword('');

            if (!result.status) {
                setErrorMessage(result.message);
            }
        } catch (error: unknown) {
            setPassword('');
            setErrorMessage(getErrorMessage(error, t('auth_error')));
        } finally {
            setLoading(false);
        }
    };

    const handleOperatorLogin = async () => {
        const identifier = operatorIdentifier.trim();
        if (!/^\d{1,30}$/.test(identifier)) {
            setErrorMessage(t('login_operator_identifier_required'));
            return;
        }

        if (cardLoginPending.current) return;
        cardLoginPending.current = true;
        setLoading(true);
        setErrorMessage(null);
        try {
            const result = await loginWithCard(identifier);
            if (!result.status) setErrorMessage(result.message);
            setOperatorIdentifier('');
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, t('auth_error')));
        } finally {
            cardLoginPending.current = false;
            setLoading(false);
        }
    };

    return {
        t,
        login,
        username,
        setUsername,
        password,
        setPassword,
        showPassword,
        setShowPassword,
        showOperatorSession,
        setShowOperatorSession,
        operatorIdentifier,
        cardInputRef,
        setOperatorIdentifier,
        loading,
        errorMessage,
        setErrorMessage,
        handleSubmit,
        handleOperatorLogin,
    };
}
