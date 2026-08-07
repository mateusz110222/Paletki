import React, { useState } from 'react';
import { Lock, User, Key, ShieldCheck, AlertCircle, Loader2, UserCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { useAuth } from '../auth/AuthContext';

export const LoginView: React.FC = () => {
    const { t } = useTranslation();
    const { login, loginAsGuest } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!username.trim() || !password) return;

        setLoading(true);
        setErrorMessage(null);

        try {
            await login(username.trim(), password);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setErrorMessage(errorMessage || t('auth_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-brand-bg flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Dynamic visual background elements */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 space-y-8 animate-in fade-in zoom-in-95 duration-500">
                {/* Header / Logo */}
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent mb-2 shadow-inner">
                        <ShieldCheck size={36} />
                    </div>
                    <span className="text-xs font-black tracking-[0.25em] text-brand-accent uppercase">
                        DASH-SOLDER SMT
                    </span>
                    <h1 className="text-2xl font-black text-brand-text tracking-tight uppercase">
                        {t('login_title')}
                    </h1>
                    <p className="text-xs font-medium text-brand-text-muted">
                        {t('login_subtitle')}
                    </p>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-red-400 text-xs animate-in fade-in duration-300">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="font-bold uppercase tracking-wider">{t('login_error_title')}</p>
                            <p className="text-red-300/90 leading-relaxed">{errorMessage}</p>
                        </div>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
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
                                type="password"
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('login_password_placeholder')}
                                className="w-full bg-brand-bg border border-brand-border rounded-xl py-3.5 pl-11 pr-4 text-sm text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                            />
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

                    <button
                        type="button"
                        onClick={loginAsGuest}
                        className="w-full py-3.5 bg-brand-bg border border-brand-border hover:bg-brand-surface-high hover:border-brand-accent/40 text-brand-text font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <UserCircle size={18} className="text-brand-accent" />
                        <span>{t('login_guest_button')}</span>
                    </button>
                </form>

                {/* Footer security note */}
                <div className="pt-4 border-t border-brand-border/60 text-center">
                    <p className="text-[10px] font-bold text-brand-text-muted/60 uppercase tracking-widest">
                        BorgWarner Corporate Active Directory Secured
                    </p>
                </div>
            </div>
        </div>
    );
};