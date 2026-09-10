import React, { useState } from 'react';

import { useTranslation } from '../i18n/LanguageContext';
import { useAuth } from '../auth/AuthContext';
import { useDocumentMetadata } from '../hooks/useDocumentMetadata.ts';
import { getErrorMessage } from '../lib/errors';

export function useLoginView() {
    const {t, language} = useTranslation();
    const {login, loginAsOperator} = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showOperatorSession, setShowOperatorSession] = useState(false);
    const [operatorIdentifier, setOperatorIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useDocumentMetadata(
        `PalletX | ${t('login_title')}`,
        t('app_meta_description'),
        language,
    );

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!username.trim() || !password) return;

        setLoading(true);
        setErrorMessage(null);

        try {
            const result = await login(username.trim(), password);

            if (!result.status) {
                setErrorMessage(result.message);
            }
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, t('auth_error')));
        } finally {
            setLoading(false);
        }
    };

    const handleOperatorLogin = async () => {
        const identifier = operatorIdentifier.trim();
        if (!identifier) {
            setErrorMessage(t('login_operator_identifier_required'));
            return;
        }

        setLoading(true);
        setErrorMessage(null);
        try {
            const result = await loginAsOperator(identifier);
            if (!result.status) setErrorMessage(result.message);
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, t('auth_error')));
        } finally {
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
        setOperatorIdentifier,
        loading,
        errorMessage,
        setErrorMessage,
        handleSubmit,
        handleOperatorLogin,
    };
}
