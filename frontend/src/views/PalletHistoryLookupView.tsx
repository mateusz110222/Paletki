import {useState, type FormEvent} from 'react';
import {Link, useNavigate} from 'react-router';
import {ArrowLeft, ArrowRight, History, Scan} from 'lucide-react';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {getErrorMessage} from '../lib/errors';

export function PalletHistoryLookupView() {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const navigate = useNavigate();
    const [id, setId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    async function openHistory(event: FormEvent) {
        event.preventDefault();
        const palletId = id.trim().toUpperCase();
        if (!palletId || loading) return;
        setLoading(true); setError(null);
        try {
            const {pallet} = await apiClient.pallet.GetPallet(palletId, {acceptLanguage: language});
            navigate(`/maintenance/pallets/${encodeURIComponent(pallet.pallet_id)}/history`);
        } catch (cause) {
            setError(getErrorMessage(cause, t('history_load_error')));
        } finally {setLoading(false);}
    }
    return <div className="mx-auto w-full max-w-3xl space-y-5">
        <Link to="/maintenance" className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-brand-text-muted hover:text-brand-accent"><ArrowLeft size={15}/>{t('maintenance_back')}</Link>
        <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
            <div className="h-1 bg-brand-accent"/>
            <header className="flex items-start gap-4 border-b border-brand-border p-6">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-brand-accent/30 bg-brand-accent/10 text-brand-accent"><History size={24}/></span>
                <div><h2 className="text-xl font-black">{t('maintenance_history_title')}</h2><p className="mt-2 text-sm leading-relaxed text-brand-text-muted">{t('maintenance_history_description')}</p></div>
            </header>
            <form onSubmit={event => void openHistory(event)} className="space-y-4 p-6">
                <label htmlFor="history-pallet-id" className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t('history_lookup_label')}</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                        <Scan size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-accent"/>
                        <input id="history-pallet-id" autoFocus autoComplete="off" spellCheck={false} value={id} onChange={event => setId(event.target.value)} disabled={loading} className="h-14 w-full rounded-xl border border-brand-border bg-brand-bg pl-12 pr-4 font-mono text-lg font-bold uppercase text-brand-text focus:border-brand-accent focus:outline-none"/>
                    </div>
                    <button type="submit" disabled={loading || !id.trim()} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white transition-colors hover:bg-brand-accent/80 disabled:opacity-50">{loading ? t('features_loading') : t('history_lookup_button')}<ArrowRight size={18}/></button>
                </div>
                {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
            </form>
        </section>
    </div>;
}
