import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link} from 'react-router';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, ArrowRight, CheckCircle2, Scan, WashingMachine, X} from 'lucide-react';
import type {Pallet} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {asPallet} from '../lib/api';
import {getErrorMessage} from '../lib/errors';
import {PalletStatusSpan} from '../components/PalletStatusSpan';
import {TextareaField} from '../components/FormFields';

export function WashingScannerView() {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const cache = useQueryClient();
    const [id, setId] = useState('');
    const [pallet, setPallet] = useState<Pallet | null>(null);
    const [comment, setComment] = useState('');
    const [scanning, setScanning] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{error: boolean; text: string} | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const abort = useRef<AbortController | null>(null);
    const request = useRef(0);
    const savingRef = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true; input.current?.focus();
        return () => {mounted.current = false; abort.current?.abort();};
    }, []);
    const allowed = pallet?.status === 'Active' || pallet?.status === 'Washing_Required';
    const alreadyZero = pallet?.status === 'Active' && pallet.current_cycles === 0;
    function clear() {setPallet(null); setComment(''); setId(''); requestAnimationFrame(() => input.current?.focus());}
    async function scan(event: FormEvent) {
        event.preventDefault();
        const palletId = id.trim().toUpperCase();
        if (!palletId || savingRef.current) return;
        abort.current?.abort();
        const controller = new AbortController(); abort.current = controller;
        const serial = ++request.current;
        setScanning(true); setPallet(null); setComment(''); setFeedback(null);
        try {
            const scanApi = apiClient.with({fetcher: (url, init) => fetch(url, {...init, signal: controller.signal})});
            const response = await scanApi.pallet.GetPallet(palletId, {acceptLanguage: language});
            if (serial === request.current && mounted.current) {setPallet(asPallet(response.pallet)); setId('');}
        } catch (error) {
            if (!controller.signal.aborted && mounted.current) setFeedback({error: true, text: getErrorMessage(error, t('washing_error'))});
        } finally {
            if (serial === request.current && mounted.current) setScanning(false);
        }
    }
    async function confirm() {
        if (!pallet || !allowed || alreadyZero || savingRef.current || scanning) return;
        savingRef.current = true; setSaving(true); setFeedback(null);
        try {
            const response = await apiClient.pallet.ConfirmPalletWashing({pallet_id: pallet.pallet_id,
                expected_cycles: pallet.current_cycles, expected_updated_at: pallet.updated_at, comment: comment.trim(), acceptLanguage: language});
            await Promise.all([cache.invalidateQueries({queryKey: ['pallets']}), cache.invalidateQueries({queryKey: ['operator-reports']}), cache.invalidateQueries({queryKey: ['reports']})]);
            if (mounted.current) {
                setFeedback({error: false, text: response.reset ? t('washing_success', {palletId: pallet.pallet_id}) : t('washing_already_zero')});
                clear();
            }
        } catch (error) {
            if (mounted.current) {setFeedback({error: true, text: getErrorMessage(error, t('washing_error'))}); clear();}
        } finally {
            savingRef.current = false;
            if (mounted.current) setSaving(false);
        }
    }
    return <div className="mx-auto w-full max-w-4xl space-y-5">
        <Link to="/maintenance" className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-brand-text-muted hover:text-brand-accent"><ArrowLeft size={15}/>{t('maintenance_back')}</Link>
        <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
            <div className="h-1 bg-emerald-400/70"/>
            <header className="flex items-start gap-4 border-b border-brand-border p-6">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><WashingMachine size={24}/></span>
                <div><h2 className="text-xl font-black text-brand-text">{t('washing_panel_title')}</h2><p className="mt-2 max-w-xl text-xs leading-relaxed text-brand-text-muted">{t('washing_confirm_hint')}</p></div>
            </header>
            <div className="space-y-5 p-6">
                <form onSubmit={event => void scan(event)}>
                    <label htmlFor="washing-scanner-input" className="mb-2 block text-[10px] font-black uppercase tracking-wider text-brand-text-muted">{t('washing_scan_label')}</label>
                    <div className="flex gap-2 rounded-xl border border-brand-border bg-brand-bg px-4 focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/10">
                        <Scan size={21} className="my-auto shrink-0 text-brand-accent"/>
                        <input id="washing-scanner-input" ref={input} value={id} onChange={e => setId(e.target.value.toUpperCase())} disabled={saving || scanning} autoComplete="off" placeholder={t('op_scan_placeholder')} className="min-w-0 flex-1 bg-transparent py-4 font-mono text-lg font-bold uppercase tracking-wider text-brand-text outline-none"/>
                        <button type="submit" disabled={!id.trim() || saving || scanning} aria-label={t('washing_scan_button')} className="my-2 rounded-lg px-3 text-brand-accent hover:bg-brand-accent/10 disabled:opacity-30"><ArrowRight size={20}/></button>
                    </div>
                </form>
                {scanning && <p role="status" className="text-xs text-brand-text-muted">{t('op_scanning')}</p>}
                {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.error ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`}>{feedback.text}</p>}
                {!pallet && !scanning && !feedback && <p className="py-5 text-center text-xs text-brand-text-muted">{t('washing_ready')}</p>}
                {pallet && <div className="space-y-5 border-t border-brand-border pt-5">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-all font-mono text-2xl font-black text-brand-text">{pallet.pallet_id}</h2><p className="mt-1 break-words text-xs text-brand-text-muted">{pallet.project} · {pallet.model} · {pallet.machine}</p></div><div className="flex shrink-0 items-center gap-2"><PalletStatusSpan status={pallet.status} block_reason={pallet.block_reason}/><button type="button" onClick={clear} disabled={saving} aria-label={t('washing_new_scan')} className="rounded-lg border border-brand-border p-2 text-brand-text-muted"><X size={16}/></button></div></div>
                    <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-brand-border bg-brand-bg p-4"><p className="text-[10px] font-bold uppercase text-brand-text-muted">{t('washing_before')}</p><p className="mt-2 font-mono text-xl font-black sm:text-3xl text-brand-text">{pallet.current_cycles}<span className="ml-2 text-xs font-semibold text-brand-text-muted">/ {pallet.max_cycles}</span></p></div><div className="rounded-xl border border-brand-border bg-brand-bg p-4"><p className="text-[10px] font-bold uppercase text-brand-text-muted">{t('washing_total')}</p><p className="mt-2 font-mono text-xl font-black sm:text-3xl text-brand-text">{pallet.total_cycles}</p></div></div>
                    {!allowed && <div role="alert" className="space-y-2 rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200"><p>{t('washing_unavailable')}</p>{pallet.block_reason && <p className="whitespace-pre-wrap break-words">{pallet.block_reason}</p>}<Link to={`/maintenance/service?searchTerm=${encodeURIComponent(pallet.pallet_id)}`} className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-brand-accent">{t('maintenance_service_title')}<ArrowRight size={14}/></Link></div>}
                    {alreadyZero && <p role="status" className="text-sm font-semibold text-emerald-300">{t('washing_already_zero')}</p>}
                    {allowed && !alreadyZero && <><TextareaField label={t('washing_note')} value={comment} onChange={e => setComment(e.target.value)} disabled={saving} maxLength={1000} rows={2}/><button type="button" disabled={saving || scanning} onClick={() => void confirm()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-black text-brand-bg hover:bg-emerald-300 disabled:opacity-50"><CheckCircle2 size={18}/>{t(saving ? 'saving' : 'washing_confirm')}</button></>}
                </div>}
            </div>
        </section>
    </div>;
}
