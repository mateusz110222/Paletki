import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Download, FileSpreadsheet, RefreshCw, CalendarClock, ArrowRight, FilterX, SlidersHorizontal} from 'lucide-react';
import {PALLET_STATUSES, type PalletStatus} from '@backend/shared/types';
import type {ReportRow} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext';
import {useTranslation, type TranslationKey} from '../i18n/LanguageContext';
import {PalletStatusSpan} from '../components/PalletStatusSpan';
import {InputField} from '../components/FormFields';
import {getErrorMessage} from '../lib/errors';

export function ReportsView() {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const [mode, setMode] = useState<'history' | 'current'>('history');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [statuses, setStatuses] = useState<PalletStatus[]>([]);
    const [offset, setOffset] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const filters = {mode, from: from || undefined, to: to || undefined, statuses: statuses.join(','), acceptLanguage: language};
    const invalidDates = Boolean(from && to && from > to);
    const query = useQuery({queryKey: ['reports', filters, offset], enabled: !invalidDates,
        queryFn: () => apiClient.pallet.GetReports({...filters, offset, limit: 50})});
    const statusLabel = (value: string) => PALLET_STATUSES.includes(value as PalletStatus)
        ? t(`status_${value.toLowerCase()}` as TranslationKey) : value;
    const headers = [t('col_pallet_id'), t('reports_current_metadata'), t('reports_model_metadata'),
        t('reports_machine_metadata'), t('reports_previous'), t('col_status'), `${t('reports_date')} (Europe/Warsaw)`,
        t('defect_label'), t('report_description'), t('reports_operator')];
    function reset() {setOffset(0); setExportError('');}
    async function exportReport() {
        if (exporting || invalidDates) return;
        setExporting(true); setExportError('');
        try {
            const rows: ReportRow[] = [];
            let next: number | undefined = 0;
            do {
                const page = await apiClient.pallet.GetReports({...filters, limit: 200, offset: next});
                rows.push(...page.rows);
                next = page.next_offset;
            } while (next !== undefined);
            const {createReportWorkbook} = await import('../lib/reportWorkbook');
            const blob = await createReportWorkbook(rows, {sheet: t(mode === 'history' ? 'reports_history' : 'reports_current'),
                headers, status: statusLabel, other: t('op_other_fault_type')});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `PalletX_${mode}_${from || 'all'}_${to || 'all'}.xlsx`;
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {setExportError(getErrorMessage(e, t('reports_error')));}
        finally {setExporting(false);}
    }
    const hasFilters = Boolean(from || to || statuses.length);
    function clearFilters() {setFrom(''); setTo(''); setStatuses([]); reset();}
    const renderStatus = (status: string) => PALLET_STATUSES.includes(status as PalletStatus)
        ? <PalletStatusSpan status={status as PalletStatus}/> : <span className="text-xs font-semibold text-brand-text-muted">{status}</span>;
    return <div className="space-y-5 text-brand-text">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-5">
            <div className="inline-flex rounded-xl border border-brand-border bg-brand-bg p-1" role="group" aria-label={t('reports_title')}>
                {(['history', 'current'] as const).map(value => <button key={value} type="button" disabled={exporting} aria-pressed={mode === value} onClick={() => {setMode(value); reset();}} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-bold transition-all sm:px-5 ${mode === value ? 'bg-brand-surface-high text-brand-text shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}>{value === 'history' ? <CalendarClock size={16} className={mode === value ? 'text-brand-accent' : ''}/> : <FileSpreadsheet size={16} className={mode === value ? 'text-brand-accent' : ''}/>}<span>{t(value === 'history' ? 'reports_history' : 'reports_current')}</span></button>)}
            </div>
            <button type="button" disabled={exporting || invalidDates || query.isPending || query.isError || !query.data?.rows.length} onClick={() => void exportReport()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-accent px-5 text-xs font-black text-brand-bg transition-colors hover:bg-brand-accent/90 disabled:opacity-40"><Download size={17}/>{t(exporting ? 'reports_exporting' : 'reports_export')}</button>
        </section>
        <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
            <header className="flex items-center justify-between gap-3 border-b border-brand-border bg-brand-surface-high/20 px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-brand-text-muted"><SlidersHorizontal size={14}/>{t('reports_filters')}</h2>
                <button type="button" disabled={!hasFilters || exporting} onClick={clearFilters} className="flex items-center gap-1.5 text-[10px] font-bold text-brand-text-muted transition-colors hover:text-brand-accent disabled:opacity-30"><FilterX size={14}/>{t('reports_clear')}</button>
            </header>
            <div className="grid gap-6 p-5 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InputField label={t('reports_from')} type="date" value={from} disabled={exporting} onChange={e => {setFrom(e.target.value); reset();}}/>
                    <InputField label={t('reports_to')} type="date" value={to} disabled={exporting} onChange={e => {setTo(e.target.value); reset();}}/>
                </div>
                <fieldset disabled={exporting} className="min-w-0 space-y-2.5"><legend className="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">{t('col_status')}</legend>
                    <div className="flex flex-wrap gap-2">{PALLET_STATUSES.map(status => <button key={status} type="button" aria-pressed={statuses.includes(status)} onClick={() => {setStatuses(values => values.includes(status) ? values.filter(v => v !== status) : [...values, status]); reset();}} className={`min-h-10 rounded-xl border px-3 text-xs font-bold transition-colors ${statuses.includes(status) ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent' : 'border-brand-border bg-brand-bg text-brand-text-muted hover:border-brand-text-muted/40'}`}>{statusLabel(status)}</button>)}</div>
                </fieldset>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-border/50 bg-brand-bg/30 px-5 py-3 text-[10px] text-brand-text-muted"><span className="inline-flex items-center gap-2"><CalendarClock size={13}/>{from || to ? `${from || '…'} — ${to || '…'}` : t('reports_all_dates')} · {statuses.length ? statuses.map(statusLabel).join(', ') : t('reports_all_statuses')}</span><span>Europe/Warsaw</span></div>
        </section>
        {(invalidDates || query.isError || exportError) && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">{invalidDates ? t('reports_invalid_dates') : exportError || getErrorMessage(query.error, t('reports_error'))}</p>}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-5 py-4">
                <div><h2 className="text-sm font-black text-brand-text">{t('reports_results')} <span className="ml-2 rounded-md border border-brand-border bg-brand-bg px-2 py-0.5 font-mono text-[10px] text-brand-text-muted">{query.data?.rows.length ?? 0}</span></h2><p className="mt-1 text-[10px] text-brand-text-muted">{t(mode === 'history' ? 'reports_date' : 'reports_status_entry')} · {t('reports_metadata')}</p></div>
                <button type="button" disabled={query.isFetching || exporting || invalidDates} aria-label={t('reports_refresh')} onClick={() => void query.refetch()} className="rounded-lg border border-brand-border p-2 text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-accent disabled:opacity-40"><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''}/></button>
            </header>
            {query.isPending && !invalidDates && <div role="status" className="space-y-3 p-6"><p className="text-xs text-brand-text-muted">{t('features_loading')}</p>{[1,2,3].map(row => <div key={row} className="h-12 animate-pulse rounded-lg bg-brand-surface-high/50"/>)}</div>}
            {!invalidDates && !query.isPending && !query.isError && query.data?.rows.length === 0 && <div className="px-6 py-16 text-center"><FileSpreadsheet size={30} className="mx-auto text-brand-text-muted/30"/><p className="mt-4 text-sm font-semibold text-brand-text-muted">{t('reports_empty')}</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-3 text-xs font-bold text-brand-accent">{t('reports_clear')}</button>}</div>}
            {!invalidDates && Boolean(query.data?.rows.length) && <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-b border-brand-border bg-brand-bg/40 text-[10px] uppercase tracking-wider text-brand-text-muted"><tr>{[t('col_pallet_id'),t('col_project')+' / '+t('col_model'),t('label_machine'),t('col_status'),t('reports_date'),t('report_description'),t('reports_operator')].map(header => <th key={header} className="whitespace-nowrap px-5 py-3 font-bold">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-brand-border/60">{query.data?.rows.map(row => <tr key={row.id} className="align-top transition-colors hover:bg-brand-surface-high/25">
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-sm font-black text-brand-accent">{row.pallet_id}</td>
                    <td className="px-5 py-4"><p className="whitespace-nowrap font-bold text-brand-text">{row.project}</p><p className="mt-1 whitespace-nowrap text-[10px] text-brand-text-muted">{row.model}</p></td>
                    <td className="px-5 py-4"><span className="rounded-md border border-brand-border bg-brand-bg px-2 py-1 font-mono text-[10px] font-bold text-brand-text-muted">{row.machine}</span></td>
                    <td className="px-5 py-4"><div className="flex flex-wrap items-center gap-1.5">{row.previous_status && mode === 'history' && row.previous_status !== row.status && <>{renderStatus(row.previous_status)}<ArrowRight size={12} className="text-brand-text-muted"/></>}{renderStatus(row.status)}</div></td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[10px]"><p>{new Date(row.timestamp).toLocaleDateString(language,{timeZone:'Europe/Warsaw'})}</p><p className="mt-1 text-brand-text-muted">{new Date(row.timestamp).toLocaleTimeString(language,{timeZone:'Europe/Warsaw'})}</p></td>
                    <td className="min-w-60 max-w-md px-5 py-4">{row.defect && <p className="mb-1.5 text-xs font-bold text-brand-text">{row.defect === 'Other' ? t('op_other_fault_type') : row.defect}</p>}<p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-brand-text-muted">{row.description || '—'}</p></td>
                    <td className="px-5 py-4 text-[10px] font-semibold text-brand-text-muted">{row.operator}</td>
                </tr>)}</tbody></table></div>}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border bg-brand-bg/20 px-5 py-3.5 text-[10px] text-brand-text-muted"><span>{t('reports_page')} <strong className="font-mono text-brand-text">{Math.floor(offset/50)+1}</strong> · {t('reports_rows_page')}: {query.data?.rows.length ?? 0}</span><div className="flex gap-2">
                <button type="button" disabled={offset === 0 || query.isFetching || exporting} className="min-h-9 rounded-lg border border-brand-border px-3 text-xs font-bold text-brand-text-muted hover:text-brand-text disabled:opacity-30" onClick={() => setOffset(value => Math.max(0,value-50))}>{t('reports_prev')}</button>
                <button type="button" disabled={query.data?.next_offset === undefined || query.isFetching || exporting || invalidDates} className="min-h-9 rounded-lg border border-brand-border px-3 text-xs font-bold text-brand-text-muted hover:text-brand-text disabled:opacity-30" onClick={() => setOffset(query.data!.next_offset!)}>{t('reports_next')}</button>
            </div></footer>
        </section>
    </div>;
}
