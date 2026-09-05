import {useEffect, useRef, useState} from 'react';
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
    const isOpen = snapshot !== null;
    useEffect(() => {
        if (!isOpen) return;
        const active = document.activeElement;
        const background = document.querySelector<HTMLElement>('.staff-screen');
        const wasInert = background?.inert ?? false;
        if (background) background.inert = true;
        return () => {
            if (background) background.inert = wasInert;
            if (active instanceof HTMLElement && active.isConnected) active.focus();
        };
    }, [isOpen]);
    const close = () => { if (!runningRef.current) setSnapshot(null); };
    useEscapeKey(Boolean(snapshot), close);
    const statusLabel = (status: PalletStatus) => ({Active: t('status_active'), Washing_Required: t('status_washing_required'), Damaged: t('damaged_status'), Blocked: t('status_blocked')})[status];
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
            await queryClient.invalidateQueries({queryKey: ['pallets']});
        } finally { runningRef.current = false; setBusy(false); }
    };
    return <>
        <div className="flex flex-wrap items-center gap-3 text-xs">
            <strong>{pl ? 'Zaznaczone' : 'Selected'}: {pallets.length}</strong>
            <button type="button" disabled={!pallets.length || busy} onClick={() => {setSnapshot([...pallets]);setReason('');setFailures([]);setProgress(0);}} className="rounded-lg border border-indigo-400/40 px-3 py-2 disabled:opacity-40">{pl ? 'Zmień status zaznaczonych' : 'Change selected status'}</button>
            <button type="button" disabled={!pallets.length || busy} onClick={exportSelected} className="rounded-lg border border-brand-border px-3 py-2 disabled:opacity-40">{pl ? 'Eksport zaznaczonych CSV' : 'Export selected CSV'}</button>
            <button type="button" disabled={!pallets.length || busy} onClick={onClear} className="px-2 py-2 disabled:opacity-40">{pl ? 'Wyczyść zaznaczenie' : 'Clear selection'}</button>
        </div>
        <ModalPresence>{snapshot && <ModalTransition onBackdropClick={close} className="overflow-y-auto">
            <section role="dialog" aria-modal="true" aria-labelledby="bulk-title" onKeyDown={event => {
                if (event.key !== 'Tab') return;
                const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
                const first = controls[0], last = controls[controls.length - 1];
                if (!first) {event.preventDefault(); return;}
                if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
                if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
            }} className="max-h-[85dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-brand-border bg-brand-surface p-6">
                <h2 id="bulk-title" className="text-xl font-bold">{pl ? 'Zmiana statusu palet' : 'Change pallet status'} · {snapshot.length}</h2>
                <p className="text-sm text-brand-text-muted">{pl ? 'Zmiana obejmie wyłącznie poniższe ID. Liczniki cykli pozostaną bez zmian.' : 'Only the IDs below will be updated. Cycle counters will remain unchanged.'}</p>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-brand-bg p-3 font-mono text-xs">{snapshot.map(p => <div key={p.pallet_id}>{p.pallet_id} · {statusLabel(p.status)}</div>)}</div>
                <label className="block text-sm">{pl ? 'Nowy status' : 'New status'}<select autoFocus disabled={busy || failures.length > 0} value={target} onChange={e => setTarget(e.target.value as PalletStatus)} className="mt-2 w-full rounded-lg border border-brand-border bg-brand-bg p-3">{PALLET_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
                <label className="block text-sm">{pl ? 'Powód zmiany (historia audytu)' : 'Reason (audit history)'}<textarea disabled={busy || failures.length > 0} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} className="mt-2 w-full rounded-lg border border-brand-border bg-brand-bg p-3"/></label>
                {busy && <p role="status">{progress} / {snapshot.length}</p>}
                {failures.length > 0 && <div role="alert" className="space-y-2 text-sm text-rose-300"><p>{pl ? 'Nieudane palety pozostały zaznaczone. Zamknij okno, sprawdź błędy i ponów wybrane zmiany.' : 'Failed pallets remain selected. Close this dialog, review the errors and retry selected changes.'}</p>{failures.map(f => <p key={f.id}>{f.id}: {f.message}</p>)}</div>}
                <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={close} className="rounded-lg border border-brand-border px-4 py-3">{pl ? 'Zamknij' : 'Close'}</button><button type="button" disabled={busy || !reason.trim() || failures.length > 0} onClick={() => void submit()} className="rounded-lg bg-brand-accent px-4 py-3 font-bold disabled:opacity-40">{pl ? 'Potwierdź zmianę' : 'Confirm change'}</button></div>
            </section>
        </ModalTransition>}</ModalPresence>
    </>;
}
