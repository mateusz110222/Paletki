import {RequiredMark} from './FormFields';
import {ModalFormActions} from './ModalFormActions';
import {PalletStatusSpan} from './PalletStatusSpan';
import {SelectedPalletList} from './SelectedPalletList';
import {useRef, useState} from 'react';
import {Download, SlidersHorizontal, X} from 'lucide-react';
import type {Pallet, PalletStatus} from '@backend/shared/types';
import {PALLET_STATUSES} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {useQueryClient} from '@tanstack/react-query';
import {useToast} from './ToastProvider';
import {ModalPresence, ModalTransition} from './ModalTransition';
import {useEscapeKey} from '../hooks/useEscapeKey';
import {escapeCsvCell} from '../lib/csv';
import {getErrorMessage} from '../lib/errors';
import {refreshPalletData} from '../lib/queryCache';

export function BulkPalletActions({pallets, onClear, onCompleted}: {pallets: Pallet[]; onClear: () => void; onCompleted: (ids: string[]) => void}) {
    const {language, t} = useTranslation();
    const pl = language === 'pl';
    const {apiClient} = useAuth();
    const queryClient = useQueryClient();
    const notify = useToast();
    const [snapshot, setSnapshot] = useState<Pallet[] | null>(null);
    const [target, setTarget] = useState<PalletStatus>('Washing_Required');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const runningRef = useRef(false);
    const [progress, setProgress] = useState(0);
    const [failures, setFailures] = useState<{id: string; message: string}[]>([]);
    const close = () => { if (!runningRef.current) setSnapshot(null); };
    useEscapeKey(Boolean(snapshot), close);
    const statusLabel = (status: PalletStatus) => ({Active: t('status_active'), Washing_Required: t('status_washing_required'), Damaged: t('status_damaged'), Blocked: t('status_blocked')})[status];
    const exportSelected = () => {
        const rows = [['ID', 'Project', 'Model', 'Status', 'Cycles', 'Max cycles'], ...pallets.map(p => [p.pallet_id, p.project, p.model, p.status, p.current_cycles, p.max_cycles])];
        const blob = new Blob(['\uFEFF' + rows.map(row => row.map(escapeCsvCell).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `pallets-${new Date().toISOString().slice(0,10)}.csv`; a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify(pl ? `Wyeksportowano ${pallets.length} palet.` : `Exported ${pallets.length} pallets.`);
    };
    const submit = async () => {
        if (!snapshot || runningRef.current || !reason.trim() || failures.length) return;
        runningRef.current = true; setBusy(true); setProgress(0);
        const done: string[] = []; const failed: {id: string; message: string}[] = [];
        try {
            for (const pallet of snapshot) {
                try {
                    await apiClient.pallet.ChangePalletStatus({pallet_id: pallet.pallet_id, new_status: target, block_reason: reason.trim(), reset_cycles: false, acceptLanguage: language});
                    done.push(pallet.pallet_id);
                } catch (error) { failed.push({id: pallet.pallet_id, message: getErrorMessage(error, pl ? 'Nie udało się zapisać.' : 'Save failed.')}); }
                setProgress(done.length + failed.length);
            }
            onCompleted(done);
            setFailures(failed);
            notify(pl ? `Zmieniono: ${done.length}. Nieudane: ${failed.length}.` : `Updated: ${done.length}. Failed: ${failed.length}.`, failed.length ? 'error' : 'success');
            if (!failed.length) setSnapshot(null);
            await refreshPalletData(queryClient);
        } finally { runningRef.current = false; setBusy(false); }
    };
    return <>
        {pallets.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-brand-border bg-brand-accent/8 px-3 py-2.5 text-xs sm:px-5 animate-in fade-in duration-200">
                <span className="inline-flex items-center gap-2 font-bold text-brand-text">
                    <span className="rounded-md bg-brand-accent px-2 py-0.5 font-mono text-xs font-black text-brand-on-accent tabular-nums">
                        {pallets.length}
                    </span>
                    <span>{pl ? 'zaznaczonych palet' : 'selected pallets'}</span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={busy} onClick={() => {setSnapshot([...pallets]);setReason('');setFailures([]);setProgress(0);}}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-accent px-3 font-bold text-brand-on-accent transition-colors hover:bg-brand-accent/90 disabled:opacity-40">
                        <SlidersHorizontal size={13} aria-hidden="true"/>
                        {pl ? 'Zmień status' : 'Change status'}
                    </button>
                    <button type="button" disabled={busy} onClick={exportSelected}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface px-3 font-bold text-brand-text transition-colors hover:border-brand-accent/40 hover:bg-brand-surface-high disabled:opacity-40">
                        <Download size={13} aria-hidden="true"/>
                        {pl ? 'Eksport CSV' : 'Export CSV'}
                    </button>
                    <button type="button" disabled={busy} onClick={onClear}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 font-semibold text-brand-text-muted transition-colors hover:bg-brand-surface hover:text-brand-text disabled:opacity-40">
                        <X size={14} aria-hidden="true"/>
                        {pl ? 'Wyczyść' : 'Clear'}
                    </button>
                </div>
            </div>
        )}
        <ModalPresence>{snapshot && <ModalTransition onBackdropClick={close} className="overflow-y-auto">
            <section role="dialog" aria-modal="true" aria-labelledby="bulk-title" className="max-h-[85dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-brand-border bg-brand-surface p-6">
                <h2 id="bulk-title" className="text-xl font-bold">{pl ? 'Zmiana statusu palet' : 'Change pallet status'} · {snapshot.length}</h2>
                <p className="text-sm text-brand-text-muted">{pl ? 'Zmiana obejmie wyłącznie poniższe ID. Liczniki cykli pozostaną bez zmian.' : 'Only the IDs below will be updated. Cycle counters will remain unchanged.'}</p>
                <SelectedPalletList pallets={snapshot} statusLabel={t('col_status')} renderStatus={pallet => <PalletStatusSpan status={pallet.status} block_reason={pallet.block_reason}/>}/>
                <label className="block text-sm">{pl ? 'Nowy status' : 'New status'}<RequiredMark/><select required autoFocus disabled={busy || failures.length > 0} value={target} onChange={e => setTarget(e.target.value as PalletStatus)} className="mt-2 w-full rounded-lg border border-brand-border bg-brand-bg p-3">{PALLET_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
                <label className="block text-sm">{pl ? 'Powód zmiany (historia audytu)' : 'Reason (audit history)'}<RequiredMark/><textarea required disabled={busy || failures.length > 0} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} className="mt-2 w-full rounded-lg border border-brand-border bg-brand-bg p-3"/></label>
                {busy && <p role="status">{progress} / {snapshot.length}</p>}
                {failures.length > 0 && <div role="alert" className="space-y-2 text-sm text-rose-300"><p>{pl ? 'Nieudane palety pozostały zaznaczone. Zamknij okno, sprawdź błędy i ponów wybrane zmiany.' : 'Failed pallets remain selected. Close this dialog, review the errors and retry selected changes.'}</p>{failures.map(f => <p key={f.id}>{f.id}: {f.message}</p>)}</div>}
                <ModalFormActions onCancel={close} cancelLabel={t('btn_close')} submitType="button"
                    onSubmit={submit} submitLabel={pl ? 'Potwierdź zmianę' : 'Confirm change'}
                    isSubmitting={busy} submitDisabled={!reason.trim() || failures.length > 0}/>
            </section>
        </ModalTransition>}</ModalPresence>
    </>;
}
