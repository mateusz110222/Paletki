import {useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link, useLocation, useSearchParams} from 'react-router';
import {Download, FileSpreadsheet, RefreshCw, CalendarClock, ArrowRight, FilterX, SlidersHorizontal, X} from 'lucide-react';
import {PALLET_STATUSES, type PalletStatus} from '@backend/shared/types';
import type {ReportRow} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext';
import {useTranslation, type TranslationKey} from '../i18n/LanguageContext';
import {PalletStatusSpan} from '../components/PalletStatusSpan';
import {InputField, SelectField} from '../components/FormFields';
import {getErrorMessage} from '../lib/errors';
import {SavedReportFilters} from '../components/SavedReportFilters';

const presets: {label: TranslationKey; previous?: PalletStatus; status?: PalletStatus; changesOnly?: boolean}[] = [
    {label: 'reports_preset_all'},
    {label: 'reports_preset_changes', changesOnly: true},
    {label: 'reports_preset_washed', previous: 'Washing_Required', status: 'Active'},
    {label: 'reports_preset_repaired', previous: 'Damaged', status: 'Active'},
    {label: 'reports_preset_unblocked', previous: 'Blocked', status: 'Active'},
    {label: 'reports_preset_washing', status: 'Washing_Required'},
    {label: 'reports_preset_damaged', status: 'Damaged'},
    {label: 'reports_preset_blocked', status: 'Blocked'},
];

const pageSize = 50;
const palletStatus = (value: string | null) => PALLET_STATUSES.find(status => status === value);
const clearedFilters = {from: '', to: '', previous: '', status: '', changes: ''};
const statusFieldClass = 'flex min-w-0 flex-col gap-1.5 min-[360px]:max-[419px]:col-span-2';

function readScope(params: URLSearchParams) {
    const from = params.get('from') || '';
    const to = params.get('to') || '';
    const previous = palletStatus(params.get('previous'));
    const status = palletStatus(params.get('status'));
    const changesOnly = params.get('changes') === '1';
    return {from, to, previous, status, changesOnly, hasFilters: Boolean(from || to || previous || status || changesOnly), invalidDates: Boolean(from && to && from > to)};
}

function updateScope(params: URLSearchParams, values: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    next.delete('offset');
    for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
    }
    return next;
}

export function ReportsView() {
    const {apiClient, user} = useAuth();
    const {t, language} = useTranslation();
    const {search} = useLocation();
    const [params, setParams] = useSearchParams();
    const dialog = useRef<HTMLDialogElement>(null);
    const [draftParams, setDraftParams] = useState(() => new URLSearchParams());
    const {from, to, previous, status, changesOnly, hasFilters, invalidDates} = readScope(params);
    const draft = readScope(draftParams);
    const requestedOffset = Number(params.get('offset'));
    const offset = Number.isSafeInteger(requestedOffset) && requestedOffset > 0 && requestedOffset % pageSize === 0 ? requestedOffset : 0;
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const filters = {mode: 'history' as const, from: from || undefined, to: to || undefined,
        previous_status: previous, statuses: status, changes_only: changesOnly || undefined, acceptLanguage: language};
    const query = useQuery({queryKey: ['reports', filters, offset], enabled: !invalidDates,
        queryFn: () => apiClient.pallet.GetReports({...filters, offset, limit: pageSize})});
    const statusLabel = (value: string) => {
        if (value === 'NEW') return t('reports_status_new');
        if (value === 'DELETED') return t('reports_status_deleted');
        return palletStatus(value) ? t(`status_${value.toLowerCase()}` as TranslationKey) : value;
    };
    const headers = [t('col_pallet_id'), t('reports_current_metadata'), t('reports_model_metadata'),
        t('reports_machine_metadata'), t('reports_previous'), t('reports_next_status'), `${t('reports_date')} (Europe/Warsaw)`,
        t('defect_label'), t('report_description'), t('reports_operator')];
    function applyParams(next: URLSearchParams) {
        setExportError('');
        setParams(next, {replace: true});
    }
    function updateParams(values: Record<string, string | undefined>) {
        applyParams(updateScope(params, values));
    }
    function editScope(values: Record<string, string | undefined>) {
        setDraftParams(current => updateScope(current, values));
    }
    async function exportReport() {
        if (exporting || invalidDates) return;
        setExporting(true); setExportError('');
        try {
            const rows: ReportRow[] = [];
            let beforeTimestamp: string | undefined;
            let beforeId: number | undefined;
            let nextOffset: number | undefined = 0;
            do {
                const page = await apiClient.pallet.GetReports({
                    ...filters,
                    limit: 200,
                    ...(beforeTimestamp && beforeId !== undefined
                        ? {before_timestamp: beforeTimestamp, before_id: beforeId}
                        : {offset: nextOffset}),
                });
                rows.push(...page.rows);
                if (page.next_before_timestamp && page.next_before_id !== undefined) {
                    beforeTimestamp = page.next_before_timestamp;
                    beforeId = page.next_before_id;
                    nextOffset = undefined;
                } else {
                    beforeTimestamp = undefined;
                    beforeId = undefined;
                    nextOffset = page.next_offset;
                }
            } while ((beforeTimestamp && beforeId !== undefined) || nextOffset !== undefined);
            const {createReportWorkbook} = await import('../lib/reportWorkbook');
            const blob = await createReportWorkbook(rows, {sheet: t('reports_history'),
                headers, status: statusLabel, other: t('op_other_fault_type')});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `PalletX_history_${from || 'all'}_${to || 'all'}.xlsx`;
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {setExportError(getErrorMessage(e, t('reports_error')));}
        finally {setExporting(false);}
    }
    const savedQuery = new URLSearchParams();
    if (draft.from) savedQuery.set('from', draft.from);
    if (draft.to) savedQuery.set('to', draft.to);
    if (draft.previous) savedQuery.set('previous', draft.previous);
    if (draft.status) savedQuery.set('status', draft.status);
    if (draft.changesOnly) savedQuery.set('changes', '1');
    const renderStatus = (value: string, row: ReportRow, before = false) => {
        const knownStatus = palletStatus(value);
        const blockReason = before && row.previous_block_reason !== undefined ? row.previous_block_reason : row.block_reason;
        return knownStatus ? <PalletStatusSpan status={knownStatus} block_reason={knownStatus === 'Damaged' ? row.damage_reason : blockReason}/>
            : <span className="text-xs font-semibold text-brand-text-muted">{statusLabel(value)}</span>;
    };
    return <div className="space-y-5 text-brand-text">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border bg-brand-surface px-3 py-2.5 sm:px-5">
            <button type="button" aria-haspopup="dialog" disabled={exporting}
                onClick={() => {setDraftParams(updateScope(params, {})); dialog.current?.showModal();}}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-40 ${hasFilters ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-brand-border hover:bg-brand-surface-high'}`}>
                <SlidersHorizontal size={16} aria-hidden="true"/>{t('reports_filters')}
            </button>
            <button type="button" disabled={exporting || invalidDates || query.isPending || query.isError || !query.data?.rows.length} onClick={() => void exportReport()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-accent px-5 text-xs font-black text-brand-on-accent transition-colors hover:bg-brand-accent/90 disabled:opacity-40"><Download size={17}/>{t(exporting ? 'reports_exporting' : 'reports_export')}</button>
        </div>
        <dialog ref={dialog} aria-labelledby="report-scope-title"
            className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-0 text-brand-text shadow-2xl open:flex open:flex-col backdrop:bg-black/65">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-border bg-brand-surface-high/25 px-4 py-2.5 sm:px-5">
                <h2 id="report-scope-title" className="flex items-center gap-2 text-base font-bold"><SlidersHorizontal size={17} aria-hidden="true"/>{t('reports_filters')}</h2>
                <button type="button" aria-label={t('btn_close')} onClick={() => dialog.current?.close()}
                    className="flex size-9 items-center justify-center rounded-lg text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text">
                    <X size={18} aria-hidden="true"/>
                </button>
            </header>
            <div className="min-h-0 space-y-5 overflow-y-auto p-4 sm:p-5">
                <fieldset disabled={exporting} className="min-w-0">
                    <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t('reports_presets')}</legend>
                    <div className="flex flex-wrap gap-2">
                        {presets.map(preset => {
                            const selected = preset.previous === draft.previous && preset.status === draft.status
                                && Boolean(preset.changesOnly) === draft.changesOnly;
                            return <button key={preset.label} type="button" aria-pressed={selected}
                                onClick={() => editScope({previous: preset.previous, status: preset.status, changes: preset.changesOnly ? '1' : undefined})}
                                className={`min-h-10 rounded-lg border px-3 text-xs font-bold transition-colors disabled:opacity-50 ${selected ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-brand-border bg-brand-bg text-brand-text-muted hover:border-brand-accent/50 hover:text-brand-text'}`}>
                                {t(preset.label)}
                            </button>;
                        })}
                    </div>
                </fieldset>
                <div className="grid gap-4 min-[360px]:grid-cols-2">
                    <InputField label={t('reports_from')} type="date" value={draft.from} onChange={e => editScope({from: e.target.value})}/>
                    <InputField label={t('reports_to')} type="date" value={draft.to} onChange={e => editScope({to: e.target.value})}/>
                    <SelectField label={t('reports_previous')} fieldClassName={statusFieldClass} value={draft.previous ?? ''} onChange={e => editScope({previous: e.target.value, changes: undefined})}>
                        <option value="">{t('reports_any_status')}</option>
                        {PALLET_STATUSES.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}
                    </SelectField>
                    <SelectField label={t('reports_next_status')} fieldClassName={statusFieldClass} value={draft.status ?? ''} onChange={e => editScope({status: e.target.value, changes: undefined})}>
                        <option value="">{t('reports_any_status')}</option>
                        {PALLET_STATUSES.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}
                    </SelectField>
                </div>
                {draft.invalidDates && <p role="alert" className="text-sm font-semibold text-red-400">{t('reports_invalid_dates')}</p>}
                {user && <SavedReportFilters key={user.username} username={user.username}
                    query={draft.invalidDates ? '' : savedQuery.toString()} disabled={exporting}
                    onApply={query => setDraftParams(updateScope(new URLSearchParams(query), {}))}/>}
            </div>
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-brand-border bg-brand-surface px-4 py-2.5 text-xs text-brand-text-muted sm:px-5">
                <span className="mr-auto inline-flex w-full items-center gap-2 min-[420px]:w-auto"><CalendarClock size={14} aria-hidden="true"/>Europe/Warsaw</span>
                <button type="button" disabled={!draft.hasFilters} onClick={() => editScope(clearedFilters)} className="flex min-h-9 items-center gap-1.5 px-2 font-bold transition-colors hover:text-brand-accent disabled:opacity-40"><FilterX size={14} aria-hidden="true"/>{t('reports_clear')}</button>
                <button type="button" disabled={draft.invalidDates} onClick={() => {applyParams(draftParams); dialog.current?.close();}}
                    className="ms-auto min-h-10 rounded-lg bg-brand-accent px-3 font-bold text-brand-on-accent hover:bg-brand-accent/90 disabled:opacity-40 min-[420px]:ms-0">{t('reports_apply')}</button>
            </footer>
        </dialog>
        {(invalidDates || query.isError || exportError) && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">{invalidDates ? t('reports_invalid_dates') : exportError || getErrorMessage(query.error, t('reports_error'))}</p>}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-5 py-4">
                <div><h2 className="text-sm font-black text-brand-text">{t('reports_results')}</h2><p className="mt-1 text-xs text-brand-text-muted">{t('reports_metadata')}</p></div>
                <button type="button" disabled={query.isFetching || exporting || invalidDates} aria-label={t('reports_refresh')} onClick={() => void query.refetch()} className="rounded-lg border border-brand-border p-2 text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-accent disabled:opacity-40"><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''}/></button>
            </header>
            {query.isPending && !invalidDates && <div role="status" className="space-y-3 p-6"><p className="text-xs text-brand-text-muted">{t('features_loading')}</p>{[1,2,3].map(row => <div key={row} className="h-12 animate-pulse rounded-lg bg-brand-surface-high/50"/>)}</div>}
            {!invalidDates && !query.isPending && !query.isError && query.data?.rows.length === 0 && <div className="px-6 py-16 text-center"><FileSpreadsheet size={30} className="mx-auto text-brand-text-muted"/><p className="mt-4 text-sm font-semibold text-brand-text-muted">{t('reports_empty')}</p>{hasFilters && <button type="button" onClick={() => updateParams(clearedFilters)} className="mt-3 text-xs font-bold text-brand-accent">{t('reports_clear')}</button>}</div>}
            {!invalidDates && Boolean(query.data?.rows.length) && <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-b border-brand-border bg-brand-bg/40 text-xs uppercase tracking-wider text-brand-text-muted"><tr>{[t('col_pallet_id'),t('col_project')+' / '+t('col_model'),t('label_machine'),t('reports_previous'),t('reports_next_status'),t('reports_date'),t('report_description'),t('reports_operator')].map(header => <th key={header} scope="col" className="whitespace-nowrap px-3 py-3 font-bold">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-brand-border/60">{query.data?.rows.map(row => <tr key={row.id} className="align-top transition-colors hover:bg-brand-surface-high/25">
                    <td className="whitespace-nowrap px-3 py-3.5 font-mono text-sm font-black">
                        <Link to={{pathname: `/reports/pallets/${encodeURIComponent(row.pallet_id)}/history`, search}}
                            aria-label={t('reports_open_history', {id: row.pallet_id})}
                            className="inline-flex items-center gap-1.5 rounded-sm text-brand-accent underline underline-offset-4 hover:text-brand-text">
                            {row.pallet_id}<ArrowRight size={13} aria-hidden="true"/>
                        </Link>
                    </td>
                    <td className="px-3 py-3.5"><p className="whitespace-nowrap font-bold text-brand-text">{row.project}</p><p className="mt-1 whitespace-nowrap text-xs text-brand-text-muted">{row.model}</p></td>
                    <td className="px-3 py-3.5"><span className="rounded-md border border-brand-border bg-brand-bg px-2 py-1 font-mono text-xs font-bold text-brand-text-muted">{row.machine}</span></td>
                    <td className="px-3 py-3.5">{row.previous_status ? renderStatus(row.previous_status, row, true) : '—'}</td>
                    <td className="px-3 py-3.5">{renderStatus(row.status, row)}{row.previous_status === row.status && <p className="mt-1 text-xs text-brand-text-muted">{t('reports_status_unchanged')}</p>}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 font-mono text-xs"><p>{new Date(row.timestamp).toLocaleDateString(language,{timeZone:'Europe/Warsaw'})}</p><p className="mt-1 text-brand-text-muted">{new Date(row.timestamp).toLocaleTimeString(language,{timeZone:'Europe/Warsaw'})}</p></td>
                    <td className="min-w-44 max-w-sm px-3 py-3.5">{row.defect && <p className="mb-1.5 text-sm font-bold text-brand-text">{row.defect === 'Other' ? t('op_other_fault_type') : row.defect}</p>}<p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-text-muted">{row.description || '—'}</p></td>
                    <td className="px-3 py-3.5 text-xs font-semibold text-brand-text-muted">{row.operator}</td>
                </tr>)}</tbody></table></div>}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border bg-brand-bg/20 px-5 py-3.5 text-xs text-brand-text-muted"><span>{t('reports_page')} <strong className="font-mono text-brand-text">{offset / pageSize + 1}</strong> · {t('reports_rows_page')}: {query.data?.rows.length ?? 0}</span><div className="flex gap-2">
                <button type="button" disabled={offset === 0 || query.isFetching || exporting} className="min-h-9 rounded-lg border border-brand-border px-3 text-xs font-bold text-brand-text-muted hover:text-brand-text disabled:opacity-30" onClick={() => updateParams({offset: offset > pageSize ? String(offset - pageSize) : undefined})}>{t('reports_prev')}</button>
                <button type="button" disabled={query.data?.next_offset === undefined || query.isFetching || exporting || invalidDates} className="min-h-9 rounded-lg border border-brand-border px-3 text-xs font-bold text-brand-text-muted hover:text-brand-text disabled:opacity-30" onClick={() => updateParams({offset: query.data?.next_offset?.toString()})}>{t('reports_next')}</button>
            </div></footer>
        </section>
    </div>;
}
