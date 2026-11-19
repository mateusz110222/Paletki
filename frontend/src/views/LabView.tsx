import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {AlertCircle, ClipboardList, FlaskConical, Plus, RefreshCw, Scan, Search, X} from 'lucide-react';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import type {pallet} from '../lib/client';
import {getErrorMessage} from '../lib/errors';
import {invalidateAndBroadcast} from '../lib/queryCache';
import {Pagination} from '../components/Pagination';
import {ModalFormActions} from '../components/ModalFormActions';
import {SelectedPalletList} from '../components/SelectedPalletList';
import {PanelChoiceCard} from '../components/PanelChoiceCard';
import {PalletScannerForm} from '../components/PalletScannerForm';

const queueKey = ['lab-strain'] as const;
const filters = ['attention', 'due_soon', 'all'] as const;

type LabSortKey = 'pallet_id' | 'project' | 'model' | 'measured_on' | 'due_on' | 'strain_status';
type LabSort = {key: LabSortKey; direction: 'asc' | 'desc'};

const statusBadgeStyle: Record<pallet.StrainPallet['strain_status'], string> = {
    current: 'bg-green-500/10 text-green-400 border-green-500/20',
    due_soon: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    missing: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    expired: 'bg-red-500/20 text-red-400 border-red-500/40',
};

const statusRank: Record<pallet.StrainPallet['strain_status'], number> = {
    expired: 0,
    missing: 1,
    due_soon: 2,
    current: 3,
};

function StrainStatusBadge({status}: {status: pallet.StrainPallet['strain_status']}) {
    const {t} = useTranslation();
    return <span className={`inline-block max-w-full wrap-anywhere rounded-full border px-2 py-0.5 text-center align-middle text-[0.6875rem] font-bold ${statusBadgeStyle[status]}`}>
        {t(`lab_${status}`)}
    </span>;
}

const control = 'rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent';
const secondary = 'inline-flex min-h-10 items-center gap-2 rounded-md border border-brand-border px-3 text-sm font-semibold hover:bg-brand-surface-high focus-visible:outline-2 focus-visible:outline-brand-accent disabled:opacity-50';
const detailColumn = 'hidden @min-[56rem]:table-cell';

function useStrainQueue() {
    const {apiClient, user} = useAuth();
    const {language} = useTranslation();
    return useQuery({
        queryKey: [...queueKey, user?.username, language],
        queryFn: () => apiClient.pallet.GetStrainPallets({acceptLanguage: language}),
        refetchInterval: 60_000,
        retry: false,
    });
}

export function LabView({mode}: {mode?: 'table' | 'scan'}) {
    const {t} = useTranslation();
    if (!mode) return <section className="@container mx-auto w-full max-w-5xl">
        <div className="grid gap-[clamp(0.75rem,2vh,1.25rem)] @min-[43rem]:grid-cols-2">
            <PanelChoiceCard to="/lab/table" title={t('lab_table_title')} description={t('lab_table_intro')} eyebrow={t('lab_status')} icon={ClipboardList}/>
            <PanelChoiceCard to="/lab/scan" title={t('lab_scan_title')} description={t('lab_scan_intro')} eyebrow={t('lab_action')} icon={Scan} tone="teal"/>
        </div>
    </section>;
    return mode === 'table' ? <LabTable/> : <LabScanner/>;
}

function LabScanner() {
    const {language, t} = useTranslation();
    const query = useStrainQueue();
    const input = useRef<HTMLInputElement>(null);
    const [id, setId] = useState('');
    const [palletId, setPalletId] = useState<string | null>(null);
    const [measurementOpen, setMeasurementOpen] = useState(false);
    const [feedback, setFeedback] = useState<'missing' | 'saved' | null>(null);
    const selected = query.data?.pallets.find(row => row.pallet_id === palletId);
    const measurementButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {input.current?.focus();}, []);

    return <section className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-brand-border bg-brand-surface" aria-labelledby="lab-scan-title">
        <div className="h-1 bg-emerald-400/70"/>
        <header className="flex items-start gap-3 border-b border-brand-border px-4 py-4 sm:px-5">
            <FlaskConical size={22} aria-hidden="true" className="mt-1 shrink-0 text-brand-text-muted"/>
            <div>
                <h1 id="lab-scan-title" className="text-xl font-bold">{t('lab_title')}</h1>
                <p className="mt-1 text-xs leading-relaxed text-brand-text-muted">{t('lab_validity')}</p>
            </div>
        </header>
        <div className="space-y-4 p-4 sm:p-5">
            <PalletScannerForm id="lab-scanner-input" label={t('lab_scan_title')} inputRef={input} value={id} ready={query.isSuccess}
                onChange={value => {setId(value); setFeedback(null);}} onSubmit={event => {
                    event.preventDefault();
                    const code = id.trim();
                    if (!query.isSuccess || !code) return;
                    const row = query.data.pallets.find(pallet => pallet.pallet_id === code);
                    setPalletId(row?.pallet_id ?? null);
                    setFeedback(row ? null : 'missing');
                    if (row) {
                        setId('');
                        requestAnimationFrame(() => measurementButton.current?.focus());
                    } else input.current?.select();
                }}/>
            {query.isPending && <p role="status" className="text-xs text-brand-text-muted">{t('lab_loading')}</p>}
            {query.isError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
                <span>{t('lab_error')}</span>
                <button type="button" className={secondary} disabled={query.isFetching} onClick={() => void query.refetch()}>{t('lab_retry')}</button>
            </div>}
            {feedback && <p role={feedback === 'missing' ? 'alert' : 'status'}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold ${feedback === 'missing' ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`}>
                {t(feedback === 'missing' ? 'lab_scan_missing' : 'lab_saved')}
            </p>}
            {!selected && !feedback && query.isSuccess && <p className="py-5 text-center text-xs text-brand-text-muted">{t('op_scan_help')}</p>}
            {selected && <div className="space-y-4 border-t border-brand-border pt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="wrap-anywhere font-mono text-2xl font-black">{selected.pallet_id}</h2>
                        <p className="mt-1 wrap-anywhere text-xs text-brand-text-muted">{selected.project} · {selected.model}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <StrainStatusBadge status={selected.strain_status}/>
                        <button type="button" onClick={() => {setPalletId(null); setId(''); setFeedback(null); input.current?.focus();}}
                            aria-label={t('washing_new_scan')} className="rounded-lg border border-brand-border p-2 text-brand-text-muted hover:text-brand-text">
                            <X size={16} aria-hidden="true"/>
                        </button>
                    </div>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-brand-border bg-brand-bg p-4">
                        <dt className="text-xs font-semibold text-brand-text-muted">{t('lab_measured')}</dt>
                        <dd className="mt-2 text-sm font-bold tabular-nums">{selected.measured_on ? formatStrainDate(selected.measured_on, language) : '—'}</dd>
                    </div>
                    <div className="rounded-xl border border-brand-border bg-brand-bg p-4">
                        <dt className="text-xs font-semibold text-brand-text-muted">{t('lab_due')}</dt>
                        <dd className="mt-2 text-sm font-bold tabular-nums">{selected.due_on ? formatStrainDate(selected.due_on, language) : '—'}</dd>
                    </div>
                </dl>
                <button ref={measurementButton} type="button" onClick={() => setMeasurementOpen(true)}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-brand-bg hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
                    <Plus size={18} aria-hidden="true"/>{t('lab_action')}
                </button>
            </div>}
        </div>
        {measurementOpen && selected && query.data && <StrainDialog pallets={[selected]} today={query.data.today}
            formatDate={value => formatStrainDate(value, language)} onClose={() => {
                setMeasurementOpen(false);
                requestAnimationFrame(() => measurementButton.current?.focus());
            }}
            onSaved={() => {setMeasurementOpen(false); setFeedback('saved'); requestAnimationFrame(() => input.current?.focus());}}/>}
    </section>;
}

function formatStrainDate(value: string, language: string) {
    return new Intl.DateTimeFormat(language, {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(value));
}

function LabTable() {
    const query = useStrainQueue();
    const {language, t} = useTranslation();
    const [filter, setFilter] = useState<(typeof filters)[number]>('attention');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<LabSort>({key: 'due_on', direction: 'asc'});
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<pallet.StrainPallet[] | null>(null);
    const [saved, setSaved] = useState(false);

    const tableScrollRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const scroller = tableScrollRef.current;
        const header = scroller?.querySelector('thead');
        const frame = scroller?.parentElement;
        if (!scroller || !header || !frame) return;
        const updateScrollbar = () => {
            frame.style.setProperty('--admin-header-height', `${header.getBoundingClientRect().height}px`);
            frame.style.setProperty('--admin-scrollbar-width', `${scroller.offsetWidth - scroller.clientWidth}px`);
        };
        const observer = new ResizeObserver(updateScrollbar);
        observer.observe(header);
        observer.observe(scroller);
        updateScrollbar();
        return () => observer.disconnect();
    }, [query.isSuccess]);

    const date = (value: string) => formatStrainDate(value, language);
    const rows = useMemo(() => query.data?.pallets ?? [], [query.data]);
    const checkedRows = rows.filter(row => checked.has(row.pallet_id));
    const counts = useMemo(() => ({
        attention: rows.filter(row => row.strain_status === 'missing' || row.strain_status === 'expired').length,
        due_soon: rows.filter(row => row.strain_status === 'due_soon').length,
        all: rows.length,
    }), [rows]);

    const term = search.trim().toLocaleLowerCase(language);
    const filteredRows = useMemo(() => rows.filter(row => {
        const inFilter = filter === 'all' || (filter === 'attention'
            ? row.strain_status === 'missing' || row.strain_status === 'expired'
            : row.strain_status === 'due_soon');
        return inFilter && [row.pallet_id, row.project, row.model].some(value => value.toLocaleLowerCase(language).includes(term));
    }), [rows, filter, term, language]);

    const sortedRows = useMemo(() => {
        const compare = new Intl.Collator(language, {numeric: true, sensitivity: 'base'});
        const multiplier = sort.direction === 'asc' ? 1 : -1;
        return [...filteredRows].sort((a, b) => {
            if (sort.key === 'measured_on' || sort.key === 'due_on') {
                const leftVal = a[sort.key];
                const rightVal = b[sort.key];
                if (!leftVal && !rightVal) return compare.compare(a.pallet_id, b.pallet_id);
                if (!leftVal) return -1 * multiplier;
                if (!rightVal) return 1 * multiplier;
                return leftVal.localeCompare(rightVal) * multiplier || compare.compare(a.pallet_id, b.pallet_id);
            }
            if (sort.key === 'strain_status') {
                const diff = statusRank[a.strain_status] - statusRank[b.strain_status];
                return diff * multiplier || compare.compare(a.pallet_id, b.pallet_id);
            }
            return compare.compare(a[sort.key], b[sort.key]) * multiplier || compare.compare(a.pallet_id, b.pallet_id);
        });
    }, [filteredRows, sort, language]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedRows = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return sortedRows.slice(start, start + pageSize);
    }, [sortedRows, safeCurrentPage, pageSize]);

    const allPageChecked = paginatedRows.length > 0 && paginatedRows.every(row => checked.has(row.pallet_id));

    const togglePageSelection = (selectAll: boolean) => {
        setChecked(prev => {
            const next = new Set(prev);
            for (const row of paginatedRows) {
                if (selectAll) next.add(row.pallet_id);
                else next.delete(row.pallet_id);
            }
            return next;
        });
    };

    const sortBy = (key: LabSortKey) => {
        setSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
        setCurrentPage(1);
    };

    const renderSortArrow = (key: LabSortKey) => (
        <span aria-hidden="true">{sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
    );

    const ariaSort = (key: LabSortKey) => (
        sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
    );

    return <section aria-labelledby="lab-heading" className="min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h1 id="lab-heading" className="text-2xl font-bold tracking-tight">{t('lab_title')}</h1>
                <p className="mt-1 text-sm text-brand-text-muted">{t('lab_validity')}</p>
            </div>
            {query.isSuccess && <p className="flex items-center gap-2 rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-xs font-bold text-brand-text-muted">
                <span aria-hidden="true" className={`size-2 rounded-full ${query.data.blocking ? 'bg-amber-300' : 'bg-brand-text-muted'}`}/>
                {t(query.data.blocking ? 'lab_blocking_on' : 'lab_blocking_off')}
            </p>}
        </div>

        {saved && <p role="status" className="text-sm text-emerald-300">{t('lab_saved')}</p>}
        {query.isPending && <p role="status" className="rounded-xl border border-brand-border bg-brand-surface p-5 text-sm text-brand-text-muted">{t('lab_loading')}</p>}
        {query.isError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-4">
            <AlertCircle size={18} className="text-rose-300" aria-hidden="true"/>
            <span>{t('lab_error')}</span>
            <button type="button" className={secondary} disabled={query.isFetching} onClick={() => void query.refetch()}>{t('lab_retry')}</button>
        </div>}

        {query.isSuccess && <div className="@container bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
            {/* Header & Filter Tabs */}
            <div className="px-6 py-4 border-b border-brand-border flex flex-wrap gap-3 justify-between items-center bg-brand-surface/50">
                <div className="flex flex-wrap gap-x-4" role="group" aria-label={t('lab_status')}>
                    {filters.map(value => <button key={value} type="button" aria-pressed={filter === value}
                        className={`min-h-10 border-b-2 px-1 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-brand-accent ${filter === value ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-muted hover:text-brand-text'}`}
                        onClick={() => {setFilter(value); setCurrentPage(1);}}>
                        {t(value === 'due_soon' ? 'lab_due_soon_filter' : `lab_${value}`)}
                        <span className="ml-1.5 rounded bg-brand-bg px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-brand-text-muted">{counts[value]}</span>
                    </button>)}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {checkedRows.length > 0 && <>
                        <button type="button" className={secondary}
                            onClick={() => {setSaved(false); setSelected(checkedRows);}}>
                            {t('lab_record_selected', {count: checkedRows.length})}
                        </button>
                        <button type="button" className="text-xs font-semibold text-brand-text-muted hover:text-brand-text px-2 py-1"
                            onClick={() => setChecked(new Set())}>
                            {language === 'pl' ? 'Wyczyść zaznaczenie' : 'Clear selection'}
                        </button>
                    </>}
                    <label className="relative block sm:w-72">
                        <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted"/>
                        <span className="sr-only">{t('lab_search')}</span>
                        <input type="search" value={search} placeholder={t('lab_search')}
                            className="h-9 w-full rounded border border-brand-border bg-brand-bg pl-9 pr-3 text-xs text-brand-text focus:border-brand-accent focus:outline-none"
                            onChange={event => {setSearch(event.target.value); setCurrentPage(1);}}/>
                    </label>
                    <div className="flex items-center gap-2">
                        <label htmlFor="lab-page-size" className="text-[0.625rem] uppercase font-bold text-brand-text-muted">
                            {t('rows_per_page')}
                        </label>
                        <select
                            id="lab-page-size"
                            value={pageSize}
                            onChange={e => {setPageSize(Number(e.target.value)); setCurrentPage(1);}}
                            className="h-9 bg-brand-bg border border-brand-border text-xs rounded px-2 text-brand-text font-medium focus:ring-1 focus:ring-brand-accent"
                        >
                            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={() => void query.refetch()}
                        disabled={query.isFetching}
                        title={t('btn_refresh_pallets')}
                        aria-label={t('btn_refresh_pallets')}
                        className="border border-brand-border text-brand-text font-bold uppercase text-xs h-9 px-3 flex items-center justify-center gap-2 hover:bg-brand-surface-high hover:border-brand-accent/40 active:scale-[0.98] transition-all rounded disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={query.isFetching ? 'animate-spin text-brand-accent' : ''}/>
                        <span>{t('btn_refresh_pallets')}</span>
                    </button>
                </div>
            </div>

            {/* Admin-style Table */}
            <div className="admin-table-frame relative">
                <div ref={tableScrollRef} className="admin-table-scroll relative max-h-[65dvh] overflow-auto">
                    <table className="w-full table-fixed border-collapse @min-[56rem]:table-auto">
                        <thead>
                            <tr className="text-left">
                                <th scope="col" className="w-9 text-center">
                                    <input
                                        type="checkbox"
                                        className="size-4 accent-brand-accent"
                                        aria-label={t('lab_selection')}
                                        disabled={paginatedRows.length === 0}
                                        checked={allPageChecked}
                                        onChange={event => togglePageSelection(event.target.checked)}
                                    />
                                </th>
                                <th scope="col" aria-sort={ariaSort('pallet_id')} className="w-[40%] px-3 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted @min-[56rem]:w-auto @min-[56rem]:px-6">
                                    <button type="button" onClick={() => sortBy('pallet_id')} className="flex items-center gap-2 whitespace-nowrap">
                                        {t('col_pallet_id')}{renderSortArrow('pallet_id')}
                                    </button>
                                </th>
                                <th scope="col" aria-sort={ariaSort('project')} className={`${detailColumn} px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted`}>
                                    <button type="button" onClick={() => sortBy('project')} className="flex items-center gap-2 whitespace-nowrap">
                                        {t('col_project')}{renderSortArrow('project')}
                                    </button>
                                </th>
                                <th scope="col" aria-sort={ariaSort('model')} className={`${detailColumn} px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted`}>
                                    <button type="button" onClick={() => sortBy('model')} className="flex items-center gap-2 whitespace-nowrap">
                                        {t('col_model')}{renderSortArrow('model')}
                                    </button>
                                </th>
                                <th scope="col" aria-sort={ariaSort('measured_on')} className={`${detailColumn} px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted`}>
                                    <button type="button" onClick={() => sortBy('measured_on')} className="flex items-center gap-2 whitespace-nowrap">
                                        {t('lab_measured')}{renderSortArrow('measured_on')}
                                    </button>
                                </th>
                                <th scope="col" aria-sort={ariaSort('due_on')} className={`${detailColumn} px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted`}>
                                    <button type="button" onClick={() => sortBy('due_on')} className="flex items-center gap-2 whitespace-nowrap">
                                        {t('lab_due')}{renderSortArrow('due_on')}
                                    </button>
                                </th>
                                <th scope="col" aria-sort={ariaSort('strain_status')} className="w-[27%] px-1 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted @min-[56rem]:w-auto @min-[56rem]:px-6">
                                    <button type="button" onClick={() => sortBy('strain_status')} className="flex items-center gap-1 text-left @min-[56rem]:gap-2 @min-[56rem]:whitespace-nowrap">
                                        {t('lab_status')}{renderSortArrow('strain_status')}
                                    </button>
                                </th>
                                <th scope="col" className="px-3 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted text-right @min-[56rem]:px-6">
                                    {t('col_actions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border">
                            {paginatedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-xs text-brand-text-muted">
                                        {t('lab_empty')}
                                    </td>
                                </tr>
                            ) : (
                                paginatedRows.map(row => (
                                    <tr key={row.pallet_id} className="hover:bg-brand-surface-high/30 transition-colors">
                                        <td className="text-center">
                                            <input type="checkbox" className="size-4 accent-brand-accent"
                                                aria-label={`${t('lab_selection')} · ${row.pallet_id}`}
                                                checked={checked.has(row.pallet_id)}
                                                onChange={event => {
                                                    const next = new Set(checked);
                                                    if (event.target.checked) next.add(row.pallet_id);
                                                    else next.delete(row.pallet_id);
                                                    setChecked(next);
                                                }}/>
                                        </td>
                                        <th scope="row" className="px-3 py-4 text-left text-xs font-semibold @min-[56rem]:px-6">
                                            <button
                                                type="button"
                                                onClick={() => {setSaved(false); setSelected([row]);}}
                                                className="max-w-full wrap-anywhere text-left font-mono text-brand-accent hover:text-brand-text hover:underline underline-offset-2 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-brand-accent rounded px-1 -mx-1"
                                            >
                                                {row.pallet_id}
                                            </button>
                                            <span className="mt-1 block wrap-anywhere font-normal text-brand-text-muted @min-[56rem]:hidden">
                                                {row.project} / {row.model}
                                                {row.measured_on && <span className="mt-1 block">{t('lab_measured')}: {date(row.measured_on)}</span>}
                                                {row.due_on && <span className="block">{t('lab_due')}: {date(row.due_on)}</span>}
                                            </span>
                                        </th>
                                        <td className={`${detailColumn} wrap-anywhere px-6 py-4 text-xs font-medium text-brand-text`}>{row.project}</td>
                                        <td className={`${detailColumn} wrap-anywhere px-6 py-4 text-xs font-medium text-brand-text`}>{row.model}</td>
                                        <td className={`${detailColumn} px-6 py-4 whitespace-nowrap text-xs tabular-nums text-brand-text-muted`}>
                                            {row.measured_on ? date(row.measured_on) : '—'}
                                        </td>
                                        <td className={`${detailColumn} px-6 py-4 whitespace-nowrap text-xs tabular-nums text-brand-text-muted`}>
                                            {row.due_on ? date(row.due_on) : '—'}
                                        </td>
                                        <td className="px-1 py-4 @min-[56rem]:px-6">
                                            <StrainStatusBadge status={row.strain_status}/>
                                        </td>
                                        <td className="px-2 py-3 text-right @min-[56rem]:px-6">
                                            <button
                                                type="button"
                                                aria-label={`${t('lab_action')} · ${row.pallet_id}`}
                                                onClick={() => {setSaved(false); setSelected([row]);}}
                                                className="inline-flex min-h-10 max-w-full items-center justify-center gap-1.5 rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 text-center text-xs font-bold text-brand-text hover:border-brand-accent/50 hover:bg-brand-surface-high hover:text-brand-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent transition-colors @min-[56rem]:px-3"
                                            >
                                                <Plus size={14} className="hidden shrink-0 @min-[56rem]:block" aria-hidden="true"/>
                                                <span>{t('lab_action')}</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalItems={sortedRows.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
            />
        </div>}

        {selected && query.isSuccess && <StrainDialog pallets={selected} today={query.data.today} formatDate={date}
            onClose={() => setSelected(null)} onSaved={() => {
                setChecked(previous => {
                    const next = new Set(previous);
                    selected.forEach(row => next.delete(row.pallet_id));
                    return next;
                });
                setSelected(null);
                setSaved(true);
            }}/>}
    </section>;
}

function StrainDialog({pallets, today, formatDate, onClose, onSaved}: {
    pallets: pallet.StrainPallet[];
    today: string;
    formatDate: (value: string) => string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const {apiClient, user} = useAuth();
    const {language, t} = useTranslation();
    const queryClient = useQueryClient();
    const dialog = useRef<HTMLDialogElement>(null);
    const [measuredOn, setMeasuredOn] = useState(today);
    const palletId = pallets[0].pallet_id;
    const single = pallets.length === 1;
    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        element?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
        return () => element?.close();
    }, []);
    const history = useQuery({
        queryKey: [...queueKey, user?.username, palletId, language],
        queryFn: () => apiClient.pallet.GetStrainHistory({pallet_id: palletId, acceptLanguage: language}),
        enabled: single,
        retry: false,
    });
    const save = useMutation({
        mutationFn: () => apiClient.pallet.RecordStrainMeasurements({
            pallet_ids: pallets.map(row => row.pallet_id),
            measured_on: measuredOn,
            acceptLanguage: language,
        }),
        onSuccess: () => {
            onSaved();
            void invalidateAndBroadcast(queryClient, [queueKey]);
        },
    });
    return <dialog ref={dialog} aria-labelledby="lab-dialog-title" className="m-auto max-h-[90dvh] w-[min(32rem,calc(100%-2rem))] rounded-lg border border-brand-border bg-brand-surface p-5 text-brand-text shadow-xl backdrop:bg-black/60 sm:p-6"
        onCancel={event => {event.preventDefault(); if (!save.isPending) onClose();}}>
        <h2 id="lab-dialog-title" className="text-xl font-bold">{t('lab_action')}</h2>
        <form className="mt-4 space-y-4" onSubmit={event => {event.preventDefault(); if (!save.isPending) save.mutate();}}>
            <SelectedPalletList pallets={pallets} statusLabel={t('lab_status')} renderStatus={row => <StrainStatusBadge status={row.strain_status}/>}/>
            <label className="block text-sm font-semibold">
                {t('lab_date')}
                <input type="date" autoFocus required min="0001-01-01" max={today} value={measuredOn} disabled={save.isPending}
                    className={`${control} mt-2 block w-full`} onChange={event => setMeasuredOn(event.target.value)}/>
            </label>
            {save.isError && <p role="alert" className="text-sm text-rose-300">{getErrorMessage(save.error, t('lab_save_error'))}</p>}
            <ModalFormActions onCancel={onClose} submitLabel={t('lab_record')} isSubmitting={save.isPending}/>
        </form>
        {single && <section aria-labelledby="lab-history-heading" className="mt-6 border-t border-brand-border pt-4">
            <h3 id="lab-history-heading" className="font-semibold">{t('lab_history')}</h3>
            {history.isPending && <p role="status" className="mt-2 text-sm text-brand-text-muted">{t('lab_loading')}</p>}
            {history.isError && <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {t('lab_error')} <button className={secondary} onClick={() => void history.refetch()}>{t('lab_retry')}</button>
            </div>}
            {history.data?.measurements.length === 0 && <p className="mt-2 text-sm text-brand-text-muted">{t('lab_history_empty')}</p>}
            {history.isSuccess && <ul className="mt-2 divide-y divide-brand-border">
                {history.data.measurements.map(entry => <li key={entry.measured_on} className="py-2 text-sm">
                    <time dateTime={entry.measured_on} className="tabular-nums font-medium">{formatDate(entry.measured_on)}</time>
                    <p className="mt-0.5 break-words text-xs text-brand-text-muted">{t('lab_recorded_by', {
                        user: entry.recorded_by,
                        date: new Intl.DateTimeFormat(language, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw'}).format(new Date(entry.recorded_at)),
                    })}</p>
                </li>)}
            </ul>}
        </section>}
    </dialog>;
}
