import {RequiredMark} from '../components/FormFields';
import React from 'react';
import { AlertCircle, ChevronDown, Eye, EyeOff, IdCard, Key, Loader2, Lock, MonitorCog, ShieldCheck, User } from 'lucide-react';

import {useLoginView} from '../hooks/useLoginView';
import {DisplayPreferences} from '../components/DisplayPreferences';
export const LoginView: React.FC = () => {
    const {
        t,
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
    } = useLoginView();
    return (
        <div className="min-h-dvh w-full bg-brand-bg flex flex-col items-center px-4 py-3 relative font-sans select-none sm:select-auto">
            {/* Dynamic visual background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
                <div
                    className="login-glow login-glow-primary absolute -top-24 -left-24 sm:-top-40 sm:-left-40 w-64 h-64 sm:w-96 sm:h-96 bg-brand-accent/10 rounded-full blur-3xl"
                />
                <div
                    className="login-glow login-glow-secondary absolute -bottom-24 -right-24 sm:-bottom-40 sm:-right-40 w-64 h-64 sm:w-96 sm:h-96 bg-blue-600/10 rounded-full blur-3xl"
                />
            </div>

            <div className="w-full flex justify-end sm:w-auto sm:fixed sm:top-5 sm:right-6 z-20 mb-3 sm:mb-0 shrink-0">
                <DisplayPreferences/>
            </div>

            <main className="w-full max-w-[400px] z-10 my-auto">
                <div
                    className="login-card-enter w-full bg-brand-surface/95 backdrop-blur-xs border border-brand-border rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
                >
                    {/* Header / Logo */}
                    <div className="flex flex-col items-center text-center space-y-1">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent mb-1 shadow-inner shrink-0">
                            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        <span className="text-xs font-black tracking-[0.25em] text-brand-accent uppercase">
                            {t('app_product_name')}
                        </span>
                        <h1 className="text-lg sm:text-xl font-black text-brand-text tracking-tight uppercase">
                            {t('login_title')}
                        </h1>
                    </div>

                    {/* Error Banner */}
                    {errorMessage && (
                        <div
                            role="alert"
                            className="login-fields-enter bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5 text-red-400 text-xs overflow-hidden"
                        >
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                                <p className="font-bold uppercase tracking-wider text-xs">{t('login_error_title')}</p>
                                <p className="text-red-300 leading-snug break-words text-xs">{errorMessage}</p>
                            </div>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        {!showOperatorSession && (
                        <div
                            key="ldap-login"
                            className="login-fields-enter space-y-3"
                        >
                        <div className="space-y-1.5">
                            <label
                                htmlFor="login-username"
                                className="text-xs font-bold text-brand-text-muted uppercase tracking-wider block"
                            >
                                {t('login_username_label')}<RequiredMark/>
                            </label>
                            <div className="relative flex items-center">
                                <User size={17} className="absolute left-3.5 text-brand-text-muted pointer-events-none z-10" />
                                <input
                                    id="login-username"
                                    type="text"
                                    required
                                    autoComplete="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder={t('login_username_placeholder')}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 sm:py-3 pl-10 pr-4 text-sm font-mono text-brand-text placeholder:text-xs sm:placeholder:text-sm placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="login-password"
                                className="text-xs font-bold text-brand-text-muted uppercase tracking-wider block"
                            >
                                {t('login_password_label')}<RequiredMark/>
                            </label>
                            <div className="relative flex items-center">
                                <Key size={17} className="absolute left-3.5 text-brand-text-muted pointer-events-none z-10" />
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('login_password_placeholder')}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 sm:py-3 pl-10 pr-11 text-sm text-brand-text placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((visible) => !visible)}
                                    aria-label={t(showPassword ? 'login_hide_password' : 'login_show_password')}
                                    aria-pressed={showPassword}
                                    title={t(showPassword ? 'login_hide_password' : 'login_show_password')}
                                    className="absolute right-2.5 p-1.5 text-brand-text-muted hover:text-brand-accent rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 transition-colors cursor-pointer z-10"
                                >
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !username.trim() || !password}
                            className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-brand-on-accent font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_10px_20px_rgba(99,102,241,0.25)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1 cursor-pointer active:scale-[0.98]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin shrink-0" />
                                    <span className="truncate">{t('login_authenticating')}</span>
                                </>
                            ) : (
                                <>
                                    <Lock size={16} className="shrink-0" />
                                    <span className="truncate">{t('login_button')}</span>
                                </>
                            )}
                        </button>

                        <div className="relative flex py-0.5 items-center">
                            <div className="grow border-t border-brand-border/60"></div>
                            <span className="shrink mx-3 text-xs font-bold text-brand-text-muted uppercase tracking-widest">{t('login_or_divider')}</span>
                            <div className="grow border-t border-brand-border/60"></div>
                        </div>
                        </div>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                setShowOperatorSession((visible) => !visible);
                                setErrorMessage(null);
                            }}
                            disabled={loading}
                            aria-expanded={showOperatorSession}
                            aria-controls="operator-session-panel"
                            className={`w-full py-2.5 border font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-between px-3.5 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:transform-none cursor-pointer ${showOperatorSession
                                ? 'bg-brand-accent/10 border-brand-accent/50 text-brand-accent'
                                : 'bg-brand-bg border-brand-border hover:bg-brand-surface-high hover:border-brand-accent/40 text-brand-text'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <MonitorCog size={16} className="text-brand-accent shrink-0"/>
                                {t(showOperatorSession ? 'login_back_to_ldap' : 'login_operator_session_button')}
                            </span>
                            <ChevronDown
                                size={16}
                                className={`text-brand-text-muted transition-transform duration-200 ${showOperatorSession ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {showOperatorSession && (
                            <div
                                key="operator-session"
                                id="operator-session-panel"
                                className="login-fields-enter space-y-2.5 rounded-xl sm:rounded-2xl border border-brand-accent/25 bg-brand-accent/5 p-3.5"
                            >
                                <div className="flex items-start gap-2.5">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-accent/15 text-brand-accent">
                                        <IdCard size={16}/>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-black uppercase tracking-wider text-brand-text">
                                            {t('login_operator_session_title')}
                                        </p>
                                        <p className="mt-0.5 text-xs leading-snug text-brand-text-muted">
                                            {t('login_operator_session_description')}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="operator-identifier"
                                        className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted"
                                    >
                                        {t('login_operator_identifier_label')}<RequiredMark/>
                                    </label>
                                    <div className="relative flex items-center">
                                        <User size={16} className="absolute left-3.5 text-brand-text-muted"/>
                                        <input
                                            id="operator-identifier"
                                            ref={cardInputRef}
                                            type="text"
                                            value={operatorIdentifier}
                                            onChange={(event) => setOperatorIdentifier(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    void handleOperatorLogin();
                                                }
                                            }}
                                            autoComplete="off"
                                            inputMode="numeric"
                                            pattern="[0-9]{1,30}" required
                                            disabled={loading}
                                            autoFocus
                                            maxLength={30}
                                            placeholder={t('login_operator_identifier_placeholder')}
                                            className="w-full rounded-xl border border-brand-border bg-brand-bg py-2.5 pl-9 pr-3 font-mono text-sm text-brand-text outline-none transition-all focus:ring-2 focus:ring-brand-accent/20"
                                        />
                                    </div>
                                    <p className="text-xs text-brand-text-muted">
                                        {t('login_operator_identifier_examples')}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => void handleOperatorLogin()}
                                    disabled={loading || !/^\d{1,30}$/.test(operatorIdentifier.trim())}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-2.5 text-xs font-black uppercase tracking-widest text-brand-on-accent shadow-[0_8px_20px_rgba(99,102,241,0.25)] transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:transform-none cursor-pointer"
                                >
                                    {loading ? <Loader2 size={15} className="animate-spin"/> : <IdCard size={15}/>}
                                    {t(loading ? 'login_operator_session_starting' : 'login_operator_session_start')}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </main>
        </div>
    );
};
