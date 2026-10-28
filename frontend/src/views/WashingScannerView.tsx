import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link} from 'react-router';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, ArrowRight, CheckCircle2, Scan, WashingMachine, X} from 'lucide-react';
import type {Pallet} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {asPallet} from '../lib/api';
import {getErrorMessage} from '../lib/errors';
import {refreshPalletData} from '../lib/queryCache';
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
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [feedback, setFeedback] = useState<{error: boolean; text: string} | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const abort = useRef<AbortController | null>(null);
    const request = useRef(0);
    const savingRef = useRef(false);
    const mounted = useRef(true);
    const dialog = useRef<HTMLDialogElement>(null);
    const confirmButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!confirmOpen) return;
        dialog.current?.showModal();
        dialog.current?.querySelector('textarea')?.focus();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            dialog.current?.close();
            document.body.style.overflow = previousOverflow;
            (confirmButton.current ?? input.current)?.focus();
        };
    }, [confirmOpen]);
    useEffect(() => {
        mounted.current = true; input.current?.focus();
        return () => {mounted.current = false; abort.current?.abort();};
    }, []);
    const allowed = pallet?.status === 'Active' || pallet?.status === 'Washing_Required';
    const alreadyZero = pallet?.status === 'Active' && pallet.current_cycles === 0;
    const palletId = pallet?.pallet_id;
    const recentHistory = useQuery({
        queryKey: ['pallets', 'washing-history', palletId, language],
        enabled: Boolean(palletId),
        queryFn: async ({signal}) => {
            const historyApi = apiClient.with({fetcher: (url, init) => fetch(url, {...init, signal})});
            const response = await historyApi.pallet.GetPalletHistory(palletId!, {history_limit: 3, acceptLanguage: language});
            return response.history;
        },
    });
    function clear() {setConfirmOpen(false); setPallet(null); setComment(''); setId(''); requestAnimationFrame(() => input.current?.focus());}
    function closeConfirmation() {
        if (!savingRef.current) setConfirmOpen(false);
    }
    async function scan(event: FormEvent) {
        event.preventDefault();
        const palletId = id.trim().toUpperCase();
        if (!palletId || savingRef.current || confirmOpen) return;
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
        if (!confirmOpen || !pallet || !allowed || alreadyZero || savingRef.current || scanning) return;
        savingRef.current = true; setSaving(true); setFeedback(null); setConfirmError('');
        try {
            const response = await apiClient.pallet.ConfirmPalletWashing({pallet_id: pallet.pallet_id,
                expected_cycles: pallet.current_cycles, expected_updated_at: pallet.updated_at, comment: comment.trim(), acceptLanguage: language});
            if (mounted.current) {
                setFeedback({error: false, text: response.reset ? t('washing_success', {palletId: pallet.pallet_id}) : t('washing_already_zero')});
                setPallet(asPallet(response.pallet));
                setComment('');
                setConfirmOpen(false);
                requestAnimationFrame(() => input.current?.focus());
            }
            await refreshPalletData(cache);
        } catch (error) {
            if (mounted.current) setConfirmError(getErrorMessage(error, t('washing_error')));
        } finally {
            savingRef.current = false;
            if (mounted.current) setSaving(false);
        }
    }
    return <div className="mx-auto w-full max-w-6xl space-y-3">
        <Link to="/maintenance" className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-brand-text-muted hover:text-brand-accent"><ArrowLeft size={15}/>{t('maintenance_back')}</Link>
        <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
            <div className="h-1 bg-emerald-400/70"/>
            <header className="flex items-start gap-3 border-b border-brand-border px-4 py-4 sm:px-5">
                <WashingMachine size={22} className="mt-1 shrink-0 text-brand-text-muted"/>
                <div><h1 className="text-xl font-bold text-brand-text">{t('washing_panel_title')}</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-brand-text-muted">{t('washing_confirm_hint')}</p></div>
            </header>
            {/* Two equal columns share the available width with one 20px gap. */}
            <div className={`grid items-start gap-5 p-4 sm:p-5 ${pallet ? 'lg:grid-cols-2' : ''}`}>
                <div className="min-w-0 space-y-4">
                <form onSubmit={event => void scan(event)}>
                    <label htmlFor="washing-scanner-input" className="mb-2 block text-xs font-semibold text-brand-text-muted">{t('washing_scan_label')}</label>
                    <div className="flex gap-2 rounded-xl border border-brand-border bg-brand-bg px-4 focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/10">
                        <Scan size={21} className="my-auto shrink-0 text-brand-accent"/>
                        <input id="washing-scanner-input" ref={input} value={id} onChange={e => setId(e.target.value.toUpperCase())} disabled={saving || scanning} autoComplete="off" placeholder={t('op_scan_placeholder')} className="min-w-0 flex-1 bg-transparent py-3 font-mono text-base font-bold uppercase text-brand-text outline-none"/>
                        <button type="submit" disabled={!id.trim() || saving || scanning} aria-label={t('washing_scan_button')} className="my-2 rounded-lg px-3 text-brand-accent hover:bg-brand-accent/10 disabled:opacity-30"><ArrowRight size={20}/></button>
                    </div>
                </form>
                {scanning && <p role="status" className="text-xs text-brand-text-muted">{t('op_scanning')}</p>}
                {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.error ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`}>{feedback.text}</p>}
                {!pallet && !scanning && !feedback && <p className="py-5 text-center text-xs text-brand-text-muted">{t('washing_ready')}</p>}
                {pallet && <div className="space-y-4 border-t border-brand-border pt-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-all font-mono text-2xl font-black text-brand-text">{pallet.pallet_id}</h2><p className="mt-1 break-words text-xs text-brand-text-muted">{pallet.project} · {pallet.model} · {pallet.machine}</p></div><div className="flex shrink-0 items-center gap-2"><PalletStatusSpan status={pallet.status} block_reason={pallet.block_reason}/><button type="button" onClick={clear} disabled={saving} aria-label={t('washing_new_scan')} className="rounded-lg border border-brand-border p-2 text-brand-text-muted"><X size={16}/></button></div></div>
                    <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-brand-border bg-brand-bg p-4"><p className="text-[10px] font-bold uppercase text-brand-text-muted">{t('washing_before')}</p><p className="mt-2 font-mono text-xl font-black sm:text-3xl text-brand-text">{pallet.current_cycles}<span className="ml-2 text-xs font-semibold text-brand-text-muted">/ {pallet.max_cycles}</span></p></div><div className="rounded-xl border border-brand-border bg-brand-bg p-4"><p className="text-[10px] font-bold uppercase text-brand-text-muted">{t('washing_total')}</p><p className="mt-2 font-mono text-xl font-black sm:text-3xl text-brand-text">{pallet.total_cycles}</p></div></div>
                    {!allowed && <div role="alert" className="space-y-2 rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200"><p>{t('washing_unavailable')}</p>{pallet.block_reason && <p className="whitespace-pre-wrap break-words">{pallet.block_reason}</p>}<Link to={`/maintenance/service?searchTerm=${encodeURIComponent(pallet.pallet_id)}`} className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-brand-accent">{t('maintenance_service_title')}<ArrowRight size={14}/></Link></div>}
                    {alreadyZero && <p role="status" className="text-sm font-semibold text-emerald-300">{t('washing_already_zero')}</p>}
                    {allowed && !alreadyZero && <button ref={confirmButton} type="button" disabled={saving || scanning} onClick={() => {setConfirmError(''); setConfirmOpen(true);}} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-brand-bg hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-50"><CheckCircle2 size={18}/>{t('washing_open_confirmation')}</button>}
                </div>}
                </div>
                {pallet && <section aria-labelledby="washing-history-title" className="min-w-0 rounded-xl bg-brand-bg p-4">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                            <h3 id="washing-history-title" className="text-sm font-semibold text-brand-text">{t('washing_recent_history')}</h3>
                            <Link to={`/maintenance/pallets/${encodeURIComponent(pallet.pallet_id)}/history`} className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-brand-text-muted hover:text-brand-text focus-visible:outline-2 focus-visible:outline-brand-accent">{t('washing_full_history')}<ArrowRight size={14}/></Link>
                        </div>
                        {recentHistory.isPending && <p role="status" className="py-3 text-sm text-brand-text-muted">{t('history_loading')}</p>}
                        {recentHistory.isError && <div role="alert" className="py-3 text-sm text-brand-text-muted"><p>{t('history_load_error')}</p><button type="button" onClick={() => void recentHistory.refetch()} className="mt-2 min-h-11 font-semibold text-brand-text underline underline-offset-4">{t('washing_history_retry')}</button></div>}
                        {!recentHistory.isPending && !recentHistory.isError && recentHistory.data?.length === 0 && <p className="py-3 text-sm text-brand-text-muted">{t('washing_history_empty')}</p>}
                        {!recentHistory.isError && <ol className="max-h-80 overflow-y-auto overscroll-contain divide-y divide-brand-border/50" tabIndex={0} aria-label={t('washing_recent_history')}>
                            {recentHistory.data?.map(entry => <li key={entry.id} className="space-y-2 py-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-brand-text-muted">
                                    <span className="break-words">{entry.operator_id}</span>
                                    <time dateTime={entry.timestamp} className="tabular-nums">{new Date(entry.timestamp).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-GB', {dateStyle: 'short', timeStyle: 'short'})}</time>
                                </div>
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-text">{entry.description || t('washing_history_no_description')}</p>
                                {entry.comment && !entry.description.includes(entry.comment) && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-text"><span className="text-brand-text-muted">{t('history_comment')}: </span>{entry.comment}</p>}
                            </li>)}
                        </ol>}
                    </section>}
            </div>
        </section>
        <dialog ref={dialog} aria-labelledby="washing-confirm-title" aria-describedby="washing-confirm-description" onCancel={event => {event.preventDefault(); closeConfirmation();}} onClick={event => {if (event.target === event.currentTarget) {const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeConfirmation();}}} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-brand-border bg-brand-surface p-0 text-brand-text backdrop:bg-black/70">
            <form onSubmit={event => {event.preventDefault(); void confirm();}} className="font-sans tracking-normal">
                <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                    <h2 id="washing-confirm-title" className="text-xl font-semibold leading-snug">{t('washing_open_confirmation')}</h2>
                    <button type="button" onClick={closeConfirmation} disabled={saving} aria-label={t('btn_cancel')} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-50"><X size={18}/></button>
                </header>
                <div className="space-y-6 px-5 pb-6 sm:px-6">
                    <div className="space-y-3 rounded-lg bg-brand-bg px-4 py-3">
                        <p className="break-all font-mono text-xl font-semibold leading-relaxed">{pallet?.pallet_id}</p>
                        <p id="washing-confirm-description" className="text-sm font-normal leading-6 text-brand-text-muted">{t('washing_modal_description')}</p>
                    </div>
                    <div className="space-y-3">
                        <TextareaField autoFocus label={t('washing_note')} fieldClassName="flex flex-col gap-3" labelClassName="text-sm font-medium leading-6 text-brand-text" className="min-h-28 w-full resize-y rounded-lg border border-brand-border bg-brand-bg px-4 py-3 text-base font-normal leading-6 tracking-normal text-brand-text outline-none focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/30" value={comment} onChange={e => setComment(e.target.value)} disabled={saving} maxLength={1000} rows={3} aria-describedby="washing-note-hint washing-note-limit"/>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs font-normal leading-5 text-brand-text-muted">
                            <p id="washing-note-hint">{t('washing_note_hint')}</p>
                            <p id="washing-note-limit" className="shrink-0 tabular-nums">{comment.length} / 1000</p>
                        </div>
                    </div>
                    {confirmError && <p role="alert" className="text-sm leading-6 text-rose-200">{confirmError}</p>}
                </div>
                <footer className="flex flex-wrap justify-end gap-3 border-t border-brand-border/60 bg-brand-bg/40 px-5 py-4 sm:px-6">
                    <button type="button" onClick={closeConfirmation} disabled={saving} className="min-h-11 rounded-lg border border-brand-border px-5 text-sm font-medium leading-6 hover:bg-brand-surface-high disabled:opacity-50">{t('btn_cancel')}</button>
                    <button type="submit" disabled={saving || !allowed || alreadyZero} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold leading-6 text-brand-bg hover:bg-emerald-300 disabled:opacity-50"><CheckCircle2 size={18}/>{t(saving ? 'saving' : 'washing_save')}</button>
                </footer>
            </form>
        </dialog>
    </div>;
}
