import type {SortOrder, EventType} from '../hooks/usePalletHistoryView';

import React, {} from 'react';
import { ArrowLeft, ArrowRight, CalendarClock, Check, Copy, Download, ExternalLink, FileClock, Filter, History, RotateCcw, Search, UserRound } from 'lucide-react';

import { AuditLog, PALLET_STATUSES, PalletStatus } from '@backend/shared/types';

import { PalletStatusSpan } from '../components/PalletStatusSpan.tsx';

import { Pagination } from '../components/Pagination.tsx';
import { formatHistoryEntries, formatOperatorsCount } from '../i18n/pluralization.ts';

import {usePalletHistoryView} from '../hooks/usePalletHistoryView';
export const PalletHistoryView: React.FC = () => {
    const {
        navigate,
        t,
        language,
        pallet,
        history,
        isLoading,
        error,
        query,
        setQuery,
        sortOrder,
        setSortOrder,
        eventType,
        setEventType,
        statusFilter,
        setStatusFilter,
        operator,
        setOperator,
        setPage,
        pageSize,
        setPageSize,
        isCopied,
        localizedStatusLabels,
        operators,
        filteredHistory,
        totalPages,
        safePage,
        visibleHistory,
        fisHistoryUrl,
        hasFilters,
        clearFilters,
        handleCopyPalletId,
        handleExportCSV,
    } = usePalletHistoryView();
    const renderStatus = (status: string, description?: string) => {
        if (PALLET_STATUSES.includes(status as PalletStatus)) {
            return <PalletStatusSpan status={status as PalletStatus} block_reason={description}/>;
        }
        return (
            <span className="inline-flex rounded-full border border-brand-border bg-brand-surface-high px-2 py-1 text-[0.625rem] font-bold uppercase text-brand-text-muted">
                {status}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="space-y-5 animate-pulse" aria-label={t('history_loading')}>
                <div className="h-32 rounded-2xl border border-brand-border bg-brand-surface"/>
                <div className="h-20 rounded-xl border border-brand-border bg-brand-surface"/>
                {[1, 2, 3].map((item) => (
                    <div key={item} className="ml-8 h-32 rounded-xl border border-brand-border bg-brand-surface"/>
                ))}
            </div>
        );
    }

    if (error || !pallet) {
        return (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
                <History className="mx-auto mb-3 text-red-400" size={32}/>
                <h3 className="font-bold text-brand-text">{t('history_load_error')}</h3>
                <p className="mt-2 text-sm text-red-300">{error}</p>
                <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 py-2 text-xs font-bold uppercase text-brand-text transition-colors hover:border-brand-accent hover:text-brand-accent"
                >
                    <ArrowLeft size={15}/> {t('history_back_to_admin')}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" id="pallet-history-container">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-text-muted transition-colors hover:text-brand-accent"
                >
                    <ArrowLeft size={16}/> {t('history_back_to_admin')}
                </button>

                <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={filteredHistory.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs font-bold uppercase text-brand-text transition-all hover:border-brand-accent hover:bg-brand-surface-high disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download size={15} className="text-brand-accent"/>
                    <span>{t('btn_export_pallet_csv')}</span>
                </button>
            </div>

            <section className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-6">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-accent/10 blur-3xl"/>
                <div className="relative flex flex-col gap-6 2xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-brand-accent/30 bg-brand-accent/15 text-brand-accent">
                            <FileClock size={27}/>
                        </div>
                        <div>
                            <p className="text-[0.625rem] font-black uppercase tracking-[0.2em] text-brand-text-muted">{t('audit_trail_title')}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-3">
                                {fisHistoryUrl ? (
                                    <a
                                        href={fisHistoryUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 font-mono text-3xl font-black text-brand-accent transition-colors hover:text-brand-text"
                                        title={t('fis_unit_history_link_label', {palletId: pallet.pallet_id, fis: Number(pallet.fis)})}
                                    >
                                        {pallet.pallet_id}<ExternalLink size={18}/>
                                    </a>
                                ) : (
                                    <h3 className="font-mono text-3xl font-black text-brand-accent">{pallet.pallet_id}</h3>
                                )}

                                <button
                                    type="button"
                                    onClick={handleCopyPalletId}
                                    title={isCopied ? t('pallet_id_copied') : t('copy_pallet_id')}
                                    aria-label={isCopied ? t('pallet_id_copied') : t('copy_pallet_id')}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-bg px-2.5 py-1 text-xs font-semibold text-brand-text-muted transition-colors hover:border-brand-accent hover:text-brand-accent"
                                >
                                    {isCopied ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                                    <span className="text-[0.625rem]">{isCopied ? t('pallet_id_copied') : t('copy_pallet_id')}</span>
                                </button>

                                {pallet.status && <PalletStatusSpan status={pallet.status}/>}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-brand-text">
                                {pallet.project} <span className="text-brand-text-muted">•</span> {pallet.model}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 min-w-0">
                        <div className="rounded-xl border border-brand-border bg-brand-bg/70 p-4">
                            <p className="text-[0.5625rem] font-bold uppercase tracking-wider text-brand-text-muted">{t('col_total_cycles')}</p>
                            <p className="mt-1 font-mono text-lg font-black text-brand-text">{pallet.total_cycles ?? 0}</p>
                            <p className="text-[0.625rem] text-brand-text-muted">{t('cycles_unit')}</p>
                        </div>
                        <div className="rounded-xl border border-brand-border bg-brand-bg/70 p-4">
                            <p className="text-[0.5625rem] font-bold uppercase tracking-wider text-brand-text-muted">{t('col_fis')}</p>
                            <p className="mt-1 font-mono text-lg font-black text-brand-text">FIS {pallet.fis ?? '—'}</p>
                            {fisHistoryUrl && <p className="text-[0.625rem] text-brand-accent">{t('history_fis_link_available')}</p>}
                        </div>
                        <div className="rounded-xl border border-brand-border bg-brand-bg/70 p-4">
                            <p className="text-[0.5625rem] font-bold uppercase tracking-wider text-brand-text-muted">{t('history_entries')}</p>
                            <p className="mt-1 font-mono text-lg font-black text-brand-text">{history.length}</p>
                            <p className="text-[0.625rem] text-brand-text-muted">{formatHistoryEntries(history.length, language, false)}</p>
                        </div>
                        <div className="rounded-xl border border-brand-border bg-brand-bg/70 p-4">
                            <p className="text-[0.5625rem] font-bold uppercase tracking-wider text-brand-text-muted">{t('history_operators')}</p>
                            <p className="mt-1 font-mono text-lg font-black text-brand-text">{operators.length}</p>
                            <p className="truncate text-[0.625rem] text-brand-text-muted">
                                {formatOperatorsCount(operators.length, language, false)}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Filters bar */}
            <section className="rounded-2xl border border-brand-border bg-brand-surface p-4">
                <div className="staff-filter-grid grid gap-3">
                    <label className="relative block">
                        <span className="sr-only">{t('history_search_placeholder')}</span>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" size={16}/>
                        <input
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setPage(1);
                            }}
                            placeholder={t('history_search_placeholder')}
                            className="h-11 w-full rounded-lg border border-brand-border bg-brand-bg pl-10 pr-3 text-xs text-brand-text outline-none transition-colors"
                        />
                    </label>
                    <label>
                        <span className="sr-only">{t('history_status_filter')}</span>
                        <select
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setPage(1);
                            }}
                            className="h-11 w-full rounded-lg border border-brand-border bg-brand-bg px-3 text-xs font-semibold text-brand-text outline-none"
                        >
                            <option value="ALL">{t('all_statuses')}</option>
                            {PALLET_STATUSES.map((status) => (
                                <option key={status} value={status}>{localizedStatusLabels[status]}</option>
                            ))}
                        </select>
                    </label>
                    <label className="relative">
                        <span className="sr-only">{t('history_event_filter')}</span>
                        <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" size={15}/>
                        <select
                            value={eventType}
                            onChange={(event) => {
                                setEventType(event.target.value as EventType);
                                setPage(1);
                            }}
                            className="h-11 w-full rounded-lg border border-brand-border bg-brand-bg pl-9 pr-3 text-xs font-semibold text-brand-text outline-none"
                        >
                            <option value="all">{t('history_all_events')}</option>
                            <option value="status">{t('history_status_changes')}</option>
                            <option value="update">{t('history_updates')}</option>
                        </select>
                    </label>
                    <label className="relative">
                        <span className="sr-only">{t('history_operator_filter')}</span>
                        <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" size={15}/>
                        <select
                            value={operator}
                            onChange={(event) => {
                                setOperator(event.target.value);
                                setPage(1);
                            }}
                            className="h-11 w-full rounded-lg border border-brand-border bg-brand-bg pl-9 pr-3 text-xs font-semibold text-brand-text outline-none"
                        >
                            <option value="ALL">{t('history_all_operators')}</option>
                            {operators.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="sr-only">{t('history_sort_label')}</span>
                        <select
                            value={sortOrder}
                            onChange={(event) => {
                                setSortOrder(event.target.value as SortOrder);
                                setPage(1);
                            }}
                            className="h-11 w-full rounded-lg border border-brand-border bg-brand-bg px-3 text-xs font-semibold text-brand-text outline-none"
                        >
                            <option value="newest">{t('history_sort_newest')}</option>
                            <option value="oldest">{t('history_sort_oldest')}</option>
                        </select>
                    </label>
                    <button
                        type="button"
                        onClick={clearFilters}
                        disabled={!hasFilters}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-brand-border px-4 text-[0.625rem] font-bold uppercase tracking-wider text-brand-text-muted transition-colors hover:border-brand-accent hover:text-brand-accent disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        <RotateCcw size={14}/> {t('history_clear_filters')}
                    </button>
                </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <p className="text-xs text-brand-text-muted">
                    {t('history_showing_results', {shown: visibleHistory.length, total: filteredHistory.length})}
                </p>
                <label className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-wider text-brand-text-muted">
                    {t('history_rows_per_page')}
                    <select
                        value={pageSize}
                        onChange={(event) => {
                            setPageSize(Number(event.target.value));
                            setPage(1);
                        }}
                        className="rounded border border-brand-border bg-brand-surface px-2 py-1 text-xs text-brand-text"
                    >
                        {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                </label>
            </div>

            {visibleHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-brand-border bg-brand-surface/40 py-16 text-center">
                    <Search className="mx-auto text-brand-text-muted/50" size={32}/>
                    <p className="mt-3 text-sm font-bold text-brand-text">{t('history_no_results')}</p>
                    {hasFilters && (
                        <button type="button" onClick={clearFilters} className="mt-3 text-xs font-bold text-brand-accent hover:underline">
                            {t('history_clear_filters')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="relative space-y-4 before:absolute before:bottom-6 before:left-4.75 before:top-6 before:w-px before:bg-brand-border sm:before:left-6.75">
                    {visibleHistory.map((entry: AuditLog) => {
                        const isStatusChange = entry.previous_status !== entry.new_status;
                        return (
                            <article key={entry.id} className="relative pl-12 sm:pl-16">
                                <div className={`absolute left-3 top-6 z-10 h-4 w-4 rounded-full border-[3px] bg-brand-surface sm:left-5 ${
                                    isStatusChange ? 'border-brand-accent' : 'border-brand-text-muted'
                                }`}/>
                                <div className="group rounded-xl border border-brand-border bg-brand-surface p-5 transition-all hover:-translate-y-0.5 hover:border-brand-accent/40 hover:shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-[0.625rem] font-black uppercase tracking-[0.16em] text-brand-accent">
                                                {isStatusChange ? t('status_change') : t('status_on_modification')}
                                            </p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                {renderStatus(entry.previous_status, entry.description)}
                                                {isStatusChange && (
                                                    <>
                                                        <ArrowRight size={14} className="text-brand-text-muted"/>
                                                        {renderStatus(entry.new_status, entry.description)}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 text-[0.6875rem] font-mono text-brand-text-muted">
                                            <CalendarClock size={14}/>
                                            {new Date(entry.timestamp).toLocaleString(language)}
                                        </div>
                                    </div>

                                    {entry.description && (
                                        <p className="mt-4 rounded-lg border border-brand-border/60 bg-brand-bg/70 px-4 py-3 text-xs leading-relaxed text-brand-text">
                                            {entry.description}
                                        </p>
                                    )}

                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border/50 pt-3 text-[0.625rem] text-brand-text-muted">
                                        <span className="inline-flex items-center gap-1.5">
                                            <UserRound size={13}/>
                                            {t('audit_operator_label')}: <strong className="text-brand-text">{entry.operator_id}</strong>
                                        </span>
                                        <span className="font-mono">{t('audit_log_id_label')}: {entry.id}</span>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* Pagination Component */}
            <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
                <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    totalItems={filteredHistory.length}
                    pageSize={pageSize}
                    onPageChange={setPage}
                />
            </div>
        </div>
    );
};
