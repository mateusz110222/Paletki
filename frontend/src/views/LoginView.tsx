import React, { useState } from 'react';
import {
    AlertCircle,
    ChevronDown,
    Eye,
    EyeOff,
    IdCard,
    Key,
    Loader2,
    Lock,
    MonitorCog,
    ShieldCheck,
    User,
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { useAuth } from '../auth/AuthContext';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {useDocumentMetadata} from '../hooks/useDocumentMetadata.ts';

export const LoginView: React.FC = () => {
    const {t, language} = useTranslation();
    const {login, loginAsOperator} = useAuth();
    const reduceMotion = useReducedMotion();

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
            const message = error instanceof Error ? error.message : String(error);
            setErrorMessage(message);
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
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh box-border w-full bg-brand-bg grid place-items-center px-4 py-6 relative overflow-x-clip font-sans">
            {/* Dynamic visual background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <motion.div
                className="absolute -top-40 -left-40 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl"
                animate={reduceMotion ? undefined : {x: [0, 28, 0], y: [0, 18, 0], scale: [1, 1.08, 1]}}
                transition={{duration: 13, repeat: Infinity, ease: 'easeInOut'}}
            />
            <motion.div
                className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"
                animate={reduceMotion ? undefined : {x: [0, -24, 0], y: [0, -16, 0], scale: [1, 1.06, 1]}}
                transition={{duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 0.6}}
            />
            </div>

            <motion.div
                initial={reduceMotion ? false : {opacity: 0, y: 22, scale: 0.97}}
                animate={{opacity: 1, y: 0, scale: 1}}
                transition={{duration: 0.5, ease: [0.22, 1, 0.36, 1]}}
                className="w-full max-w-md bg-brand-surface border border-brand-border rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 space-y-8"
            >
                {/* Header / Logo */}
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent mb-2 shadow-inner">
                        <ShieldCheck size={36} />
                    </div>
                    <span className="text-xs font-black tracking-[0.25em] text-brand-accent uppercase">
                        {t('app_product_name')}
                    </span>
                    <h1 className="text-2xl font-black text-brand-text tracking-tight uppercase">
                        {t('login_title')}
                    </h1>
                    <p className="text-xs font-medium text-brand-text-muted">
                        {t('login_subtitle')}
                    </p>
                </div>

                {/* Error Banner */}
                <AnimatePresence initial={false}>
                {errorMessage && (
                    <motion.div
                        initial={reduceMotion ? false : {opacity: 0, height: 0, y: -8}}
                        animate={{opacity: 1, height: 'auto', y: 0}}
                        exit={reduceMotion ? {opacity: 0} : {opacity: 0, height: 0, y: -8}}
                        transition={{duration: 0.24}}
                        className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-red-400 text-xs overflow-hidden"
                    >
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="font-bold uppercase tracking-wider">{t('login_error_title')}</p>
                            <p className="text-red-300/90 leading-relaxed">{errorMessage}</p>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {!showOperatorSession && (
                    <motion.div
                        key="ldap-login"
                        initial={reduceMotion ? false : {opacity: 0, y: -8}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.2, ease: [0.22, 1, 0.36, 1]}}
                        className="space-y-5"
                    >
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block">
                            {t('login_username_label')}
                        </label>
                        <div className="relative flex items-center">
                            <User size={18} className="absolute left-4 text-brand-text-muted" />
                            <input
                                type="text"
                                required
                                autoComplete="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={t('login_username_placeholder')}
                                className="w-full bg-brand-bg border border-brand-border rounded-xl py-3.5 pl-11 pr-4 text-sm font-mono text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block">
                            {t('login_password_label')}
                        </label>
                        <div className="relative flex items-center">
                            <Key size={18} className="absolute left-4 text-brand-text-muted" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('login_password_placeholder')}
                                className="w-full bg-brand-bg border border-brand-border rounded-xl py-3.5 pl-11 pr-12 text-sm text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((visible) => !visible)}
                                aria-label={t(showPassword ? 'login_hide_password' : 'login_show_password')}
                                aria-pressed={showPassword}
                                title={t(showPassword ? 'login_hide_password' : 'login_show_password')}
                                className="absolute right-3 p-1 text-brand-text-muted hover:text-brand-accent rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !username.trim() || !password}
                        className="w-full py-4 bg-brand-accent hover:bg-brand-accent/90 text-brand-bg font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_10px_20px_rgba(59,130,246,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 active:scale-[0.98]"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>{t('login_authenticating')}</span>
                            </>
                        ) : (
                            <>
                                <Lock size={16} />
                                <span>{t('login_button')}</span>
                            </>
                        )}
                    </button>

                    <div className="relative flex py-2 items-center">
                        <div className="grow border-t border-brand-border/60"></div>
                        <span className="shrink mx-4 text-[10px] font-bold text-brand-text-muted/60 uppercase tracking-widest">{t('login_or_divider')}</span>
                        <div className="grow border-t border-brand-border/60"></div>
                    </div>
                    </motion.div>
                    )}

                    <motion.button
                        type="button"
                        onClick={() => {
                            setShowOperatorSession((visible) => !visible);
                            setErrorMessage(null);
                        }}
                        disabled={loading}
                        aria-expanded={showOperatorSession}
                        aria-controls="operator-session-panel"
                        whileHover={reduceMotion ? undefined : {y: -1}}
                        whileTap={reduceMotion ? undefined : {scale: 0.985}}
                        className={`w-full py-3.5 border font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-between px-4 active:scale-[0.98] ${showOperatorSession
                            ? 'bg-brand-accent/10 border-brand-accent/50 text-brand-accent'
                            : 'bg-brand-bg border-brand-border hover:bg-brand-surface-high hover:border-brand-accent/40 text-brand-text'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <MonitorCog size={18} className="text-brand-accent"/>
                            {t(showOperatorSession ? 'login_back_to_ldap' : 'login_operator_session_button')}
                        </span>
                        <ChevronDown
                            size={17}
                            className={`text-brand-text-muted transition-transform duration-200 ${showOperatorSession ? 'rotate-180' : ''}`}
                        />
                    </motion.button>

                    {showOperatorSession && (
                        <motion.div
                            key="operator-session"
                            id="operator-session-panel"
                            initial={reduceMotion ? false : {opacity: 0, y: 10}}
                            animate={{opacity: 1, y: 0}}
                            transition={{duration: 0.22, ease: [0.22, 1, 0.36, 1]}}
                            className="space-y-4 rounded-2xl border border-brand-accent/25 bg-brand-accent/5 p-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/15 text-brand-accent">
                                    <IdCard size={18}/>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-brand-text">
                                        {t('login_operator_session_title')}
                                    </p>
                                    <p className="mt-1 text-[10px] leading-relaxed text-brand-text-muted">
                                        {t('login_operator_session_description')}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="operator-identifier"
                                    className="block text-[10px] font-bold uppercase tracking-wider text-brand-text-muted"
                                >
                                    {t('login_operator_identifier_label')}
                                </label>
                                <div className="relative flex items-center">
                                    <User size={17} className="absolute left-3.5 text-brand-text-muted"/>
                                    <input
                                        id="operator-identifier"
                                        type="text"
                                        value={operatorIdentifier}
                                        onChange={(event) => setOperatorIdentifier(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                void handleOperatorLogin();
                                            }
                                        }}
                                        autoComplete="username"
                                        autoFocus
                                        maxLength={64}
                                        placeholder={t('login_operator_identifier_placeholder')}
                                        className="w-full rounded-xl border border-brand-border bg-brand-bg py-3 pl-10 pr-3 font-mono text-sm text-brand-text outline-none transition-all focus:ring-2 focus:ring-brand-accent/20"
                                    />
                                </div>
                                <p className="text-[9px] text-brand-text-muted/70">
                                    {t('login_operator_identifier_examples')}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => void handleOperatorLogin()}
                                disabled={loading || operatorIdentifier.trim().length < 2}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-3 text-[11px] font-black uppercase tracking-widest text-brand-bg shadow-[0_8px_20px_rgba(99,102,241,0.25)] transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:transform-none"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin"/> : <IdCard size={16}/>}
                                {t(loading ? 'login_operator_session_starting' : 'login_operator_session_start')}
                            </button>
                        </motion.div>
                    )}
                </form>

                {/* Footer security note */}
                <div className="pt-4 border-t border-brand-border/60 text-center">
                    <p className="text-[10px] font-bold text-brand-text-muted/60 uppercase tracking-widest">
                        {t('login_security_note')}
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
