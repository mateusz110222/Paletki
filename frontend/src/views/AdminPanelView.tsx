import { BulkPalletActions } from '../components/BulkPalletActions';

import React, { useLayoutEffect, useRef } from 'react';
import { AlertCircle, Copy, Download, Edit, History, PlusCircle, RefreshCw, RotateCcw, ShieldAlert, Trash2, X } from 'lucide-react';
import { TranslationKey } from '../i18n/LanguageContext.tsx';
import { Pallet, PalletModel, PALLET_STATUSES, PalletStatus, Project } from '@backend/shared/types';
import { useAdminPanel } from '../hooks/useAdminPanel.ts';
import { PalletStatusSpan } from "../components/PalletStatusSpan.tsx";
import { GlobalErrorModal } from "../components/GlobalErrorModal.tsx";

import { SearchInput } from "../components/SearchInput.tsx";
import { useEscapeKey } from "../hooks/useEscapeKey.ts";
import { ModalFormActions } from "../components/ModalFormActions.tsx";
import { ModalPresence, ModalTransition } from '../components/ModalTransition.tsx';
import { InputField, SelectField, TextareaField } from '../components/FormFields.tsx';
import { Pagination } from '../components/Pagination.tsx';
import {useAdminPanelView} from '../hooks/useAdminPanelView';
interface AdminPanelViewProps {
    pallets: Pallet[];
    projects: Project[];
    models: PalletModel[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

const ErrorAlert: React.FC<{ message: string }> = ({message}) => {
    if (!message) return null;
    return (
        <div
            className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs flex items-center gap-2 mb-4">
            <AlertCircle className="shrink-0" size={16}/>
            <span>{message}</span>
        </div>
    );
};

export const AdminPanelView: React.FC<AdminPanelViewProps> = (props) => {
    const {data, status, actions} = useAdminPanel(props);
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
    }, []);
    const previousPageRef = useRef(data.currentPage);
    useLayoutEffect(() => {
        if (previousPageRef.current === data.currentPage) return;
        previousPageRef.current = data.currentPage;
        const table = tableScrollRef.current;
        if (!table) return;
        table.scrollTo({top: 0, behavior: 'instant'});
        table.scrollIntoView({block: 'start', inline: 'nearest', behavior: 'instant'});
    }, [data.currentPage]);
    const {
        t,
        language,
        selectedIds,
        setSelectedIds,
        hiddenColumns,
        selectedPallets,
        toggleSelected,
        pageIds,
        allPageSelected,
        togglePage,
        toggleColumn,
        sortBy,
        searchParams,
        setSearchParams,
        selectedProjectFromUrl,
        selectedModelFromUrl,
        selectedStatusFromUrl,
        searchTermFromURL,
        hasActiveFilters,
        cycleStepEvery,
        cycleStepAmount,
        isAddPalletValid,
        openPalletHistory,
        clearFilters,
    } = useAdminPanelView(props, {data, status, actions});
    const hasOpenModal = data.selectedPalletForUnblock !== null || data.errorModalState.isOpen || data.selectedPalletForDelete !== null ||
        data.isBlockOpen || data.isEditOpen || data.isAddOpen;

    useEscapeKey(hasOpenModal, () => {
        if (data.selectedPalletForUnblock) {
            actions.closeUnblock();
        } else if (data.errorModalState.isOpen) {
            actions.hideGlobalError();
        } else if (!status.isSubmitting && data.selectedPalletForDelete) {
            actions.setSelectedPalletForDelete(null);
        } else if (!status.isSubmitting && data.isBlockOpen) {
            actions.setIsBlockOpen(false);
        } else if (!status.isSubmitting && data.isEditOpen) {
            actions.setIsEditOpen(false);

        } else if (!status.isSubmitting && data.isAddOpen) {
            actions.setIsAddOpen(false);
        }
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" id="admin-panel-container">
            {/* Quick Stats & Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {/* Available Card */}
                <div
                    className="bg-brand-surface p-6 rounded-xl border border-brand-border flex flex-col justify-between relative overflow-hidden group hover:border-brand-accent/50 transition-colors">
                    <span
                        className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t('stats_available_pallets')}</span>
                    <span className="text-4xl font-extrabold text-brand-accent mt-2">{data.availableStock}</span>
                    <div className="flex items-center gap-1 text-[0.625rem] text-green-400 mt-2">
                        <span>● {data.avaliblePalletes_Percenetege} % {t('availability_ok_suffix')}</span>
                    </div>
                </div>

                {/* Blocked / Maint Card */}
                <div
                    className="bg-brand-surface p-6 rounded-xl border border-brand-border flex flex-col justify-between relative overflow-hidden group hover:border-brand-accent/50 transition-colors">
                    <span
                        className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t('stats_service_blocked')}</span>
                    <span className="text-4xl font-extrabold text-red-400 mt-2">{data.blockedOrMaint}</span>
                    <div className="flex items-center gap-1 text-[0.625rem] text-red-400 mt-2">
                        <ShieldAlert size={12}/>
                        <span>{t('maintenance_abbreviation')}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="sm:col-span-2 flex flex-col gap-3 justify-center">
                    <div className="staff-action-grid grid gap-3">
                        <button
                            onClick={actions.handleOpenAddPallet}
                            className="flex-1 bg-brand-accent text-brand-bg font-bold uppercase text-xs min-h-14 px-3 py-3 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all rounded"
                        >
                            <PlusCircle size={18}/>
                            {t('btn_add_pallet')}
                        </button>

                        <button
                            onClick={actions.handleExportAuditTrail}
                            className="flex-1 border border-brand-border text-brand-text font-bold uppercase text-xs min-h-14 px-3 py-3 flex items-center justify-center gap-2 hover:bg-brand-surface-high active:scale-[0.98] transition-all rounded"
                        >
                            <Download size={18}/>
                            {t('btn_export_audit')}
                        </button>
                    </div>

                    <SearchInput searchTerm={searchTermFromURL} searchParams={searchParams}
                                 onSearchTermChange={actions.setSearchTerm} setSearchParams={setSearchParams}/>
                </div>
            </div>

            {/* Advanced Filters */}
            <div
                className="bg-brand-surface p-4 rounded-xl border border-brand-border flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-start gap-4">
                    {/* FILTR: PROJEKT */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="admin-filter-project" className="text-[0.625rem] uppercase font-bold text-brand-text-muted">
                            {t('filter_by_project')}
                        </label>
                        <select
                            id="admin-filter-project"
                            value={selectedProjectFromUrl}
                            onChange={(e) => {
                                const selectedValue = e.target.value;
                                const newParams = new URLSearchParams(searchParams);
                                if (selectedValue === 'ALL') {
                                    newParams.delete('project');
                                } else {
                                    newParams.set('project', selectedValue);
                                }
                                newParams.delete('model');
                                setSearchParams(newParams);
                                actions.setSelectedProject(selectedValue);
                                actions.setSelectedModel('ALL');
                            }}
                            className="bg-brand-bg border border-brand-border text-xs rounded p-2 text-brand-text font-medium focus:ring-1 focus:ring-brand-accent"
                        >
                            <option value="ALL">{t('all_projects')}</option>
                            {data.projects.map((proj: Project) => {
                                const name = proj.name;
                                return <option key={name} value={name}>{name}</option>;
                            })}
                        </select>
                    </div>

                    {/* FILTR: MODEL (Zależny od wybranego projektu) */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="admin-filter-model" className="text-[0.625rem] uppercase font-bold text-brand-text-muted">
                            {t('filter_by_model')}
                        </label>
                        <select
                            id="admin-filter-model"
                            aria-describedby={selectedProjectFromUrl === 'ALL' ? 'admin-filter-model-hint' : undefined}
                            value={selectedModelFromUrl}
                            onChange={(e) => {
                                const selectedValue = e.target.value;
                                const newParams = new URLSearchParams(searchParams);
                                if (selectedValue === 'ALL') {
                                    newParams.delete('model');
                                } else {
                                    newParams.set('model', selectedValue);
                                }
                                setSearchParams(newParams);
                                actions.setSelectedModel(selectedValue);
                            }}
                            disabled={selectedProjectFromUrl === 'ALL'}
                            className="bg-brand-bg border border-brand-border text-xs rounded p-2 text-brand-text font-medium focus:ring-1 focus:ring-brand-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="ALL">{t('all_models')}</option>
                            {data.availableModels.map((modelName: string) => (
                                <option key={modelName} value={modelName}>{modelName}</option>
                            ))}
                        </select>
                        {selectedProjectFromUrl === 'ALL' && (
                            <span id="admin-filter-model-hint" className="max-w-40 text-[0.5625rem] leading-tight text-brand-text-muted">
                                {t('filter_model_hint')}
                            </span>
                        )}
                    </div>

                    {/* FILTR: STATUS */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="admin-filter-status" className="text-[0.625rem] uppercase font-bold text-brand-text-muted">
                            {t('filter_by_status')}
                        </label>
                        <select
                            id="admin-filter-status"
                            value={selectedStatusFromUrl}
                            onChange={(e) => {
                                const selectedValue = e.target.value;
                                const newParams = new URLSearchParams(searchParams);
                                if (selectedValue === 'ALL') {
                                    newParams.delete('status');
                                } else {
                                    newParams.set('status', selectedValue);
                                }
                                setSearchParams(newParams);
                                actions.setSelectedStatus(selectedValue);
                            }}
                            className="bg-brand-bg border border-brand-border text-xs rounded p-2 text-brand-text font-medium focus:ring-1 focus:ring-brand-accent"
                        >
                            <option value="ALL">{t('all_statuses')}</option>
                            {PALLET_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {t(`status_${status.toLowerCase()}` as TranslationKey)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* PAGINACJA: ILOŚĆ NA STRONĘ */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="admin-page-size" className="text-[0.625rem] uppercase font-bold text-brand-text-muted">
                            {t('rows_per_page')}
                        </label>
                        <select
                            id="admin-page-size"
                            value={data.pageSize}
                            onChange={(e) => actions.setPageSize(Number(e.target.value))}
                            className="bg-brand-bg border border-brand-border text-xs rounded p-2 text-brand-text font-medium focus:ring-1 focus:ring-brand-accent"
                        >
                            {[25, 50, 100, 200].map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={clearFilters}
                        disabled={!hasActiveFilters}
                        className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded border border-brand-border px-3 text-[0.625rem] font-bold uppercase tracking-wider text-brand-text-muted transition-colors hover:border-brand-accent hover:text-brand-accent disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        <RotateCcw size={14} aria-hidden="true"/>
                        {t('filter_clear')}
                    </button>
                </div>

                <div className="text-xs text-brand-text-muted font-medium">
                    {t('showing')} <span
                    className="text-brand-accent font-bold">{data.filteredPallets.length}</span> {t('of')} {data.totalPallets} {t('registered_pallets')}
                </div>
            </div>

            {/* Pallet Inventory Table */}
            <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
                <div
                    className="px-6 py-4 border-b border-brand-border flex flex-wrap gap-3 justify-between items-center bg-brand-surface/50">
                    <h3 className="text-base font-bold text-brand-text">{t('pallet_inventory_title')}</h3>
                    <button
                        onClick={actions.handleRefreshPallets}
                        disabled={status.isRefreshing}
                        title={t('btn_refresh_pallets')}
                        aria-label={t('btn_refresh_pallets')}
                        className="border border-brand-border text-brand-text font-bold uppercase text-xs h-9 px-3 flex items-center justify-center gap-2 hover:bg-brand-surface-high hover:border-brand-accent/40 active:scale-[0.98] transition-all rounded disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={status.isRefreshing ? "animate-spin text-brand-accent" : ""}/>
                        <span>{t('btn_refresh_pallets')}</span>
                    </button>
                </div>
                <div className="space-y-4 border-b border-brand-border p-4">
                    <details className="text-sm"><summary className="w-fit cursor-pointer rounded-lg border border-brand-border px-3 py-2">{language === 'pl' ? 'Widoczne kolumny' : 'Visible columns'}</summary><div className="mt-3 flex flex-wrap gap-4">{([
                        ['project', 'col_project'], ['model', 'col_model'], ['fis', 'col_fis'], ['current_cycles', 'col_cycles'], ['status', 'col_status'], ['created_by', 'col_operator'], ['created_at', 'col_created_at'],
                    ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={!hiddenColumns.includes(key)} onChange={() => toggleColumn(key)}/>{t(label)}</label>)}</div></details>
                    <BulkPalletActions pallets={selectedPallets} onClear={() => setSelectedIds([])} onCompleted={ids => setSelectedIds(current => current.filter(id => !ids.includes(id)))}/>
                </div>
                <div className="admin-table-frame relative">
                <div ref={tableScrollRef} className="admin-table-scroll relative max-h-[65dvh] overflow-auto">
                    <table className="w-full border-collapse">
                        <thead>
                        <tr className="bg-brand-surface-high/30 border-b border-brand-border text-left"><th className="px-4 py-3"><input type="checkbox" aria-label={language === 'pl' ? 'Zaznacz bieżącą stronę' : 'Select current page'} checked={allPageSelected} disabled={!pageIds.length} ref={node => {if(node) node.indeterminate = !allPageSelected && pageIds.some(id => selectedIds.includes(id));}} onChange={togglePage}/></th>
                            <th aria-sort={data.sort.key === 'pallet_id' ? (data.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted"><button type="button" onClick={() => sortBy('pallet_id')} className="flex items-center gap-2 whitespace-nowrap">{t('col_pallet_id')}<span aria-hidden="true">{data.sort.key === 'pallet_id' ? (data.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                            <th hidden={hiddenColumns.includes('project')} aria-sort={data.sort.key === 'project' ? (data.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted"><button type="button" onClick={() => sortBy('project')} className="flex items-center gap-2 whitespace-nowrap">{t('col_project')}<span aria-hidden="true">{data.sort.key === 'project' ? (data.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                            <th hidden={hiddenColumns.includes('model')} aria-sort={data.sort.key === 'model' ? (data.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted"><button type="button" onClick={() => sortBy('model')} className="flex items-center gap-2 whitespace-nowrap">{t('col_model')}<span aria-hidden="true">{data.sort.key === 'model' ? (data.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                            <th hidden={hiddenColumns.includes('fis')} aria-sort={data.sort.key === 'fis' ? (data.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted"><button type="button" onClick={() => sortBy('fis')} className="flex items-center gap-2 whitespace-nowrap">{t('col_fis')}<span aria-hidden="true">{data.sort.key === 'fis' ? (data.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                            <th hidden={hiddenColumns.includes('current_cycles')} aria-sort={data.sort.key === 'current_cycles' ? (data.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted"><button type="button" onClick={() => sortBy('current_cycles')} className="flex items-center gap-2 whitespace-nowrap">{t('col_cycles')}<span aria-hidden="true">{data.sort.key === 'current_cycles' ? (data.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                            <th hidden={hiddenColumns.includes('status')} aria-sort={data.sort.key === 'status' ? (data.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted"><button type="button" onClick={() => sortBy('status')} className="flex items-center gap-2 whitespace-nowrap">{t('col_status')}<span aria-hidden="true">{data.sort.key === 'status' ? (data.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                            <th hidden={hiddenColumns.includes('created_by')} aria-sort={data.sort.key === 'created_by' ? (data.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted"><button type="button" onClick={() => sortBy('created_by')} className="flex items-center gap-2 whitespace-nowrap">{t('col_operator')}<span aria-hidden="true">{data.sort.key === 'created_by' ? (data.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                            <th hidden={hiddenColumns.includes('created_at')} aria-sort={data.sort.key === 'created_at' ? (data.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted"><button type="button" onClick={() => sortBy('created_at')} className="flex items-center gap-2 whitespace-nowrap">{t('col_created_at')}<span aria-hidden="true">{data.sort.key === 'created_at' ? (data.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                            <th className="px-6 py-3 text-[0.625rem] uppercase font-bold tracking-wider text-brand-text-muted text-right">{t('col_actions')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border">
                        {data.paginatedPallets.length === 0 ? (
                            <tr>
                                <td colSpan={10 - hiddenColumns.length} className="px-6 py-10 text-center text-brand-text-muted">
                                    {t('no_pallets_found')}
                                </td>
                            </tr>
                        ) : (
                            data.paginatedPallets.map((p: Pallet) => {
                                const maxC = p.max_cycles || 200;
                                const currC = p.current_cycles || 0;
                                const usagePercent = Math.min(100, Math.round((currC / maxC) * 100));
                                const isLimitExceeded = currC >= maxC;

                                return (
                                    <tr key={p.pallet_id} className="hover:bg-brand-surface-high/30 transition-colors"><td className="px-4 py-4"><input type="checkbox" aria-label={`${language === 'pl' ? 'Zaznacz' : 'Select'} ${p.pallet_id}`} checked={selectedIds.includes(p.pallet_id)} onChange={() => toggleSelected(p.pallet_id)}/></td>
                                        <td className="px-6 py-4 font-mono text-xs font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => openPalletHistory(p)}
                                                title={t('audit_trail_title')}
                                                aria-label={`${t('audit_trail_title')}: ${p.pallet_id}`}
                                                className="text-brand-accent hover:text-brand-text hover:underline underline-offset-2 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-brand-accent rounded px-1 -mx-1"
                                            >
                                                {p.pallet_id}
                                            </button>
                                        </td>
                                        <td hidden={hiddenColumns.includes('project')} className="px-6 py-4 text-xs font-medium text-brand-text">{p.project}</td>
                                        <td hidden={hiddenColumns.includes('model')} className="px-6 py-4 text-xs font-medium text-brand-text">{p.model}</td>
                                        <td hidden={hiddenColumns.includes('fis')} className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                    <span
                                                        className="bg-brand-surface-high text-[0.5625rem] px-2 py-0.5 rounded border border-brand-border font-mono text-brand-text">
                                                        FIS: {p.fis ?? t('value_not_available')}
                                                    </span>
                                            </div>
                                        </td>
                                        <td hidden={hiddenColumns.includes('current_cycles')} className="px-6 py-4">
                                            <div className="w-32 flex flex-col gap-1">
                                                <div className="flex justify-between text-[0.625rem] font-mono">
                                                        <span
                                                            className={isLimitExceeded ? "text-red-400 font-bold" : "text-brand-text-muted"}>
                                                            {currC}
                                                        </span>
                                                    <span className="text-brand-text-muted/60">/ {maxC}</span>
                                                </div>
                                                <div
                                                    className="h-1.5 w-full bg-brand-bg rounded-full overflow-hidden border border-brand-border/40">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${isLimitExceeded
                                                            ? 'bg-red-500'
                                                            : usagePercent > 85
                                                                ? 'bg-yellow-500'
                                                                : 'bg-brand-accent'
                                                        }`}
                                                        style={{width: `${usagePercent}%`}}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td hidden={hiddenColumns.includes('status')} className="px-6 py-4">
                                            <PalletStatusSpan status={p.status as PalletStatus}
                                                              block_reason={p.block_reason}/>
                                        </td>
                                        <td hidden={hiddenColumns.includes('created_by')} className="px-6 py-4">
                                            <div className="flex flex-col">
                                                    <span
                                                        className="text-xs font-medium text-brand-text">{p.created_by}</span>
                                            </div>
                                        </td>
                                        <td hidden={hiddenColumns.includes('created_at')} className="px-6 py-4 whitespace-nowrap text-xs text-brand-text-muted">
                                            {p.created_at && Number.isFinite(Date.parse(p.created_at))
                                                ? new Date(p.created_at).toLocaleString(language)
                                                : t('value_not_available')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex min-w-48 items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openPalletHistory(p)}
                                                    title={t('audit_trail_title')}
                                                    aria-label={`${t('audit_trail_title')}: ${p.pallet_id}`}
                                                    className="rounded-lg p-2 text-brand-text-muted hover:bg-brand-accent/10 hover:text-brand-accent transition-colors"
                                                >
                                                    <History size={16}/>
                                                    <span className="sr-only">{t('audit_trail_title')}: {p.pallet_id}</span>
                                                </button>

                                                <button
                                                    onClick={() => actions.handleOpenEditModal(p)}
                                                    title={t('btn_edit')}
                                                    aria-label={`${t('btn_edit')}: ${p.pallet_id}`}
                                                    className="rounded-lg p-2 text-brand-text-muted hover:bg-brand-accent/10 hover:text-brand-accent transition-colors"
                                                >
                                                    <Edit size={16}/>
                                                    <span className="sr-only">{t('btn_edit')}: {p.pallet_id}</span>
                                                </button>

                                                <button
                                                    onClick={() => actions.handleCopyPallet(p)}
                                                    title={t('btn_copy_pallet')}
                                                    aria-label={`${t('btn_copy_pallet')}: ${p.pallet_id}`}
                                                    className="rounded-lg p-2 text-brand-text-muted hover:bg-brand-accent/10 hover:text-brand-accent transition-colors"
                                                >
                                                    <Copy size={16}/>
                                                    <span className="sr-only">{t('btn_copy_pallet')}: {p.pallet_id}</span>
                                                </button>

                                                <span aria-hidden="true" className="mx-1 h-6 w-px bg-brand-border"/>

                                                {p.status === 'Blocked' ? (
                                                    <button
                                                        onClick={() => actions.handleUnblock(p)}
                                                        title={t('btn_unblock')}
                                                        aria-label={`${t('btn_unblock')}: ${p.pallet_id}`}
                                                        className="text-xs font-bold text-green-400 hover:underline px-1"
                                                    >
                                                        {t('btn_unblock')}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => actions.handleBlockClick(p)}
                                                        title={t('btn_block')}
                                                        aria-label={`${t('btn_block')}: ${p.pallet_id}`}
                                                        className="inline-flex items-center gap-1.5 rounded-lg p-2 text-brand-text-muted hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                                                    >
                                                        <ShieldAlert size={16}/>
                                                        <span className="sr-only">{t('btn_block')}: {p.pallet_id}</span>
                                                        <span className="hidden 2xl:inline text-[0.625rem] font-bold uppercase">{t('btn_block')}</span>
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => actions.setSelectedPalletForDelete(p)}
                                                    title={t('btn_delete')}
                                                    aria-label={`${t('btn_delete')}: ${p.pallet_id}`}
                                                    className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-400 hover:border-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                                                >
                                                    <Trash2 size={16}/>
                                                    <span className="sr-only">{t('btn_delete')}: {p.pallet_id}</span>
                                                    <span className="hidden 2xl:inline text-[0.625rem] font-bold uppercase">{t('btn_delete')}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
                </div>

                {/* Paginacja */}
                <Pagination
                    currentPage={data.currentPage}
                    totalPages={data.totalPages}
                    totalItems={data.filteredPallets.length}
                    pageSize={data.pageSize}
                    onPageChange={actions.setCurrentPage}
                />
            </div>

            {/* MODAL 1: DODAWANIE NOWEJ PALETY */}
            <ModalPresence>
            {data.isAddOpen && (
                <ModalTransition
                    onBackdropClick={() => actions.setIsAddOpen(false)}
                    className="p-2 sm:p-4"
                >
                    <div
                        className="add-pallet-modal relative z-10 flex w-full flex-col overflow-hidden rounded-3xl border border-brand-border bg-brand-surface shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-pallet-title"
                    >

                        {/* Nagłówek */}
                        <div
                            className="add-pallet-modal-header flex shrink-0 items-center justify-between border-b border-brand-border bg-brand-surface-high">
                            <h3 id="add-pallet-title" className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-brand-text">
                                <div
                                    className="w-8 h-8 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent shadow-inner">
                                    <PlusCircle size={16}/>
                                </div>
                                {t('modal_add_pallet_title')}
                            </h3>
                            <button
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-brand-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
                                onClick={() => actions.setIsAddOpen(false)}
                                type="button"
                                aria-label={t('btn_cancel')}
                            >
                                <X size={18}/>
                            </button>
                        </div>

                        {/* Formularz */}
                        <form onSubmit={actions.handleAddPallet} className="flex min-h-0 flex-1 flex-col">
                            <div className="add-pallet-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain">
                            <ErrorAlert message={data.validationError}/>

                            <div className="grid grid-cols-2 gap-2 rounded-xl border border-brand-border bg-brand-bg p-1.5">
                                <button
                                    type="button"
                                    onClick={() => actions.setAddMode('single')}
                                    className={`rounded-lg px-3 py-2.5 text-[0.6875rem] font-black uppercase tracking-wide transition-colors ${data.addMode === 'single' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted hover:text-brand-text'}`}
                                >
                                    {t('add_mode_single')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => actions.setAddMode('range')}
                                    className={`rounded-lg px-3 py-2.5 text-[0.6875rem] font-black uppercase tracking-wide transition-colors ${data.addMode === 'range' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted hover:text-brand-text'}`}
                                >
                                    {t('add_mode_range')}
                                </button>
                            </div>

                            {/* Sekcja główna: ID i Projekt, zależny Model poniżej na całą szerokość */}
                            <div className="add-pallet-primary-grid grid gap-4">
                                <InputField
                                    label={data.addMode === 'range' ? t('label_first_pallet_id') : t('label_pallet_id')}
                                    type="text"
                                    autoFocus
                                    placeholder={t('placeholder_pallet_id')}
                                    value={data.newId.toUpperCase()}
                                    onChange={(e) => actions.setNewId(e.target.value.toUpperCase())}
                                    required
                                />

                                {data.addMode === 'range' && (
                                    <InputField
                                        label={t('label_last_pallet_id')}
                                        type="text"
                                        placeholder={t('placeholder_last_pallet_id')}
                                        value={data.newLastId.toUpperCase()}
                                        onChange={(e) => actions.setNewLastId(e.target.value.toUpperCase())}
                                        required
                                    />
                                )}

                                <SelectField
                                    label={t('label_project')}
                                    fieldClassName={data.addMode === 'range' ? 'add-pallet-range-catalog-field flex flex-col gap-1.5' : undefined}
                                    value={data.newProject}
                                    onChange={(e) => actions.setNewProject(e.target.value)}
                                    required
                                >
                                    <option value="">{t('placeholder_select_project')}</option>
                                    {data.projects.map((proj: Project) => {
                                        const name = proj.name
                                        return <option key={name} value={name}>{name}</option>
                                    })}
                                </SelectField>

                                <SelectField
                                    label={t('label_model')}
                                    fieldClassName={data.addMode === 'range' ? 'add-pallet-range-catalog-field flex flex-col gap-1.5' : 'flex flex-col gap-1.5 col-span-2'}
                                    value={data.newModel}
                                    onChange={(e) => actions.setNewModel(e.target.value)}
                                    disabled={!data.newProject}
                                    required
                                >
                                    <option value="">{t('placeholder_select_model')}</option>
                                    {data.newPalletModels.map((modelName: string) => (
                                        <option key={modelName} value={modelName}>{modelName}</option>
                                    ))}
                                </SelectField>
                            </div>

                            {/* Sekcja parametrów technicznych: Cykle, Gniazda, FIS */}
                            <div className="grid grid-cols-3 gap-3">
                                <InputField
                                    label={t('label_max_cycles')}
                                    labelClassName="text-[0.6875rem] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    type="number"
                                    value={data.newMaxCycles}
                                    onChange={(e) => actions.setNewMaxCycles(e.target.value)}
                                    required
                                    min="1"
                                />

                                <InputField
                                    label={t('label_nests')}
                                    labelClassName="text-[0.6875rem] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    type="number"
                                    value={data.newNests}
                                    onChange={(e) => actions.setNewNests(e.target.value)}
                                    required
                                    min="1"
                                />

                                <SelectField
                                    label={t('label_fis')}
                                    labelClassName="text-[0.6875rem] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    monospace
                                    value={data.newFis}
                                    onChange={(e) => actions.setNewFis(e.target.value)}
                                    required
                                >
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                </SelectField>
                            </div>

                            {data.addMode === 'range' && (
                                <section className="cycle-step-card rounded-2xl border border-brand-border bg-brand-surface-high/45 p-4">
                                    <label className="flex cursor-pointer items-start justify-between gap-4">
                                        <span>
                                            <span className="block text-[0.6875rem] font-black uppercase tracking-wider text-brand-text">
                                                {t('cycle_step_title')}
                                            </span>
                                            <span className="cycle-step-description mt-1 block text-[0.625rem] leading-relaxed text-brand-text-muted">
                                                {t('cycle_step_description')}
                                            </span>
                                        </span>
                                        <span className="relative mt-0.5 shrink-0">
                                            <input
                                                type="checkbox"
                                                className="cycle-stepping-toggle peer sr-only"
                                                checked={data.cycleSteppingEnabled}
                                                onChange={(event) => actions.setCycleSteppingEnabled(event.target.checked)}
                                            />
                                            <span className="block h-6 w-11 rounded-full border border-brand-border bg-brand-bg transition-colors peer-checked:border-brand-accent/60 peer-checked:bg-brand-accent/25 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-accent/40"/>
                                            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-brand-text-muted shadow-sm transition-all peer-checked:translate-x-5 peer-checked:bg-brand-accent"/>
                                        </span>
                                    </label>

                                    {data.cycleSteppingEnabled && (
                                        <div className="cycle-step-grid mt-4 grid grid-cols-2 items-end gap-3 border-t border-brand-border/70 pt-4">
                                            <InputField
                                                label={t('cycle_step_every_label')}
                                                type="number"
                                                value={data.cycleStepEvery}
                                                onChange={(event) => actions.setCycleStepEvery(event.target.value)}
                                                min="1"
                                                max="100"
                                                step="1"
                                                required
                                            />
                                            <InputField
                                                label={t('cycle_step_amount_label')}
                                                type="number"
                                                value={data.cycleStepAmount}
                                                onChange={(event) => actions.setCycleStepAmount(event.target.value)}
                                                min="1"
                                                max="1000000"
                                                step="1"
                                                required
                                            />
                                            <div className={`cycle-step-preview col-span-2 flex min-h-[2.625rem] items-center rounded-xl border px-3 py-2 font-mono text-[0.625rem] leading-relaxed ${data.rangeCyclePreview && data.rangeCyclePreview.lastLimit > 1_000_000
                                                ? 'border-red-500/30 bg-red-500/[0.07] text-red-300'
                                                : 'border-brand-accent/20 bg-brand-accent/[0.06] text-brand-text-muted'
                                            }`}>
                                                {data.rangeCyclePreview && data.rangeCyclePreview.lastLimit > 1_000_000
                                                    ? t('cycle_step_invalid')
                                                    : data.rangeCyclePreview
                                                    ? t('cycle_step_preview', {
                                                        count: data.rangeCyclePreview.palletCount,
                                                        first: data.newId.trim().toUpperCase(),
                                                        groupEnd: data.rangeCyclePreview.firstGroupEnd,
                                                        firstLimit: data.rangeCyclePreview.firstLimit,
                                                        every: cycleStepEvery,
                                                        amount: cycleStepAmount,
                                                        lastLimit: data.rangeCyclePreview.lastLimit,
                                                    })
                                                    : t('cycle_step_preview_pending')}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                            </div>

                            {/* Stopka z przyciskami akcji */}
                            <div className="add-pallet-modal-footer shrink-0 bg-brand-surface">
                                <ModalFormActions
                                    onCancel={() => actions.setIsAddOpen(false)}
                                    submitLabel={t('btn_save')}
                                    isSubmitting={status.isSubmitting}
                                    submitDisabled={!isAddPalletValid}
                                />
                            </div>
                        </form>
                    </div>
                </ModalTransition>
            )}
            </ModalPresence>

            {/* MODAL 1C: EDYCJA DANYCH PALETY */}
            <ModalPresence>
            {data.isEditOpen && data.selectedPalletForEdit && (
                <ModalTransition
                    onBackdropClick={() => actions.setIsEditOpen(false)}
                    className="overflow-y-auto"
                >
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl z-10">

                        {/* Nagłówek */}
                        <div
                            className="bg-brand-surface-high p-6 border-b border-brand-border flex justify-between items-center">
                            <h3 className="text-sm font-black text-brand-text uppercase tracking-widest flex items-center gap-2.5">
                                <div
                                    className="w-8 h-8 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent shadow-inner">
                                    <Edit size={16}/>
                                </div>
                                {t('modal_edit_pallet_title')} - {data.selectedPalletForEdit.pallet_id}
                            </h3>
                            <button
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-brand-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
                                onClick={() => actions.setIsEditOpen(false)}
                                type="button"
                                aria-label={t('btn_cancel')}
                            >
                                <X size={18}/>
                            </button>
                        </div>

                        <ErrorAlert message={data.editError}/>

                        {/* Formularz edycji */}
                        <form onSubmit={actions.handleUpdatePallet} className="p-6 space-y-6">

                            {/* Informacje o palecie (odczyt) */}
                            <div
                                className="grid grid-cols-3 gap-3 bg-brand-bg p-3 rounded-xl border border-brand-border">
                                <div>
                                    <span
                                        className="text-[0.625rem] uppercase font-bold text-brand-text-muted block">{t('col_pallet_id')}</span>
                                    <span
                                        className="font-mono text-xs font-bold text-brand-accent">{data.selectedPalletForEdit.pallet_id}</span>
                                </div>
                                <div>
                                    <span
                                        className="text-[0.625rem] uppercase font-bold text-brand-text-muted block">{t('col_project')}</span>
                                    <span
                                        className="text-xs font-semibold text-brand-text">{data.selectedPalletForEdit.project}</span>
                                </div>
                                <div>
                                    <span
                                        className="text-[0.625rem] uppercase font-bold text-brand-text-muted block">{t('col_model')}</span>
                                    <span
                                        className="text-xs font-semibold text-brand-text">{data.selectedPalletForEdit.model}</span>
                                </div>
                            </div>

                            {/* Sekcja parametrów technicznych: FIS, Gniazda (nests), Limit Cykli (max_cycles) */}
                            <div className="grid grid-cols-3 gap-3">
                                <SelectField
                                    label={t('label_fis')}
                                    labelClassName="text-[0.6875rem] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    monospace
                                    value={data.editFis}
                                    onChange={(e) => actions.setEditFis(e.target.value)}
                                    required
                                >
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                </SelectField>

                                <InputField
                                    label={<>{t('label_nests')} *</>}
                                    labelClassName="text-[0.6875rem] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    type="number"
                                    value={data.editNests}
                                    onChange={(e) => actions.setEditNests(e.target.value)}
                                    required
                                    min="1"
                                />

                                <InputField
                                    label={<>{t('label_max_cycles')} *</>}
                                    labelClassName="text-[0.6875rem] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    type="number"
                                    value={data.editMaxCycles}
                                    onChange={(e) => actions.setEditMaxCycles(e.target.value)}
                                    required
                                    min="1"
                                />
                            </div>

                            {/* Sekcja statusu */}
                            <SelectField
                                label={<>{t('col_status')} *</>}
                                value={data.editStatus}
                                onChange={(e) => actions.setEditStatus(e.target.value as PalletStatus)}
                                required
                            >
                                {PALLET_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {t(`status_${status.toLowerCase()}` as TranslationKey)}
                                    </option>))}
                            </SelectField>

                            {/* Powód Blokady (gdy wybrany status to Blocked) */}
                            {data.editStatus === 'Blocked' && (
                                <TextareaField
                                    label={<>{t('label_block_reason')} *</>}
                                    value={data.editBlockReason}
                                    onChange={(e) => actions.setEditBlockReason(e.target.value)}
                                    rows={3}
                                    placeholder={t('block_reason_required')}
                                    required
                                />
                            )}

                            {/* Stopka z przyciskami akcji */}
                            <ModalFormActions
                                onCancel={() => actions.setIsEditOpen(false)}
                                submitLabel={t('btn_save')}
                                isSubmitting={status.isSubmitting}
                            />
                        </form>
                    </div>
                </ModalTransition>
            )}
            </ModalPresence>

            {/* MODAL: Blokowanie Palety */}
            <ModalPresence>
            {data.isBlockOpen && data.selectedPalletForBlock && (
                <ModalTransition
                    onBackdropClick={() => {
                        if (!status.isSubmitting) actions.setIsBlockOpen(false);
                    }}
                    backdropClassName="bg-black/60 backdrop-blur-sm"
                >
                    <div
                        className="bg-brand-surface border border-brand-border rounded-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-brand-border pb-3">
                            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                                <ShieldAlert size={20}/>
                                {t('btn_block')} {data.selectedPalletForBlock.pallet_id}
                            </h3>
                            <button onClick={() => actions.setIsBlockOpen(false)}
                                    aria-label={t('btn_cancel')}
                                    className="text-brand-text-muted hover:text-brand-text">
                                <X size={20}/>
                            </button>
                        </div>

                        <ErrorAlert message={data.blockError}/>

                        <form onSubmit={actions.handleConfirmBlock} className="space-y-4">
                            <div>
                                <label
                                    className="text-xs font-bold text-brand-text-muted uppercase block mb-1">{t('block_reason')}</label>
                                <textarea
                                    value={data.blockReason}
                                    onChange={(e) => actions.setBlockReason(e.target.value)}
                                    className="w-full bg-brand-bg border border-brand-border rounded p-2 text-sm text-brand-text focus:ring-1 focus:ring-red-400"
                                    rows={3}
                                    placeholder={t('block_reason_required')}
                                />
                            </div>

                            <ModalFormActions
                                onCancel={() => actions.setIsBlockOpen(false)}
                                submitLabel={t('btn_block')}
                                submittingLabel={t('saving')}
                                isSubmitting={status.isSubmitting}
                                variant="danger"
                            />
                        </form>
                    </div>
                </ModalTransition>
            )}
            </ModalPresence>

            {/* MODAL: Potwierdzenie usunięcia paletki */}
            <ModalPresence>
            {data.selectedPalletForDelete && (
                <ModalTransition
                    onBackdropClick={() => {
                        if (!status.isSubmitting) actions.setSelectedPalletForDelete(null);
                    }}
                    backdropClassName="bg-black/70 backdrop-blur-sm"
                >
                    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-brand-surface shadow-2xl">
                        <div className="flex items-center gap-3 border-b border-red-500/20 bg-red-950/30 p-5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
                                <Trash2 size={20}/>
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-wider text-red-400">
                                    {t('modal_delete_pallet_title')}
                                </h3>
                                <p className="mt-0.5 font-mono text-xs font-bold text-brand-text">
                                    {data.selectedPalletForDelete.pallet_id}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-5 p-6">
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-brand-text">
                                    {t('delete_pallet_confirm', {
                                        palletId: data.selectedPalletForDelete.pallet_id,
                                    })}
                                </p>
                                <p className="text-xs leading-relaxed text-brand-text-muted">
                                    {t('delete_pallet_warning')}
                                </p>
                            </div>
                            <ModalFormActions
                                onCancel={() => actions.setSelectedPalletForDelete(null)}
                                submitType="button"
                                onSubmit={() => void actions.handleConfirmDeletePallet()}
                                submitLabel={t('btn_delete')}
                                submittingLabel={t('deleting_pallet')}
                                isSubmitting={status.isSubmitting}
                                variant="danger"
                            />
                        </div>
                    </div>
                </ModalTransition>
            )}
            </ModalPresence>

            <ModalPresence>
                {data.selectedPalletForUnblock && <ModalTransition onBackdropClick={actions.closeUnblock}>
                    <section role="dialog" aria-modal="true" aria-labelledby="unblock-title" aria-describedby="unblock-description"
                        onKeyDown={event => {
                            if (event.key !== 'Tab') return;
                            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
                            const first = buttons[0], last = buttons[buttons.length - 1];
                            if (!first) {event.preventDefault(); return;}
                            if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
                            if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
                        }}
                        className="w-full max-w-md space-y-4 rounded-2xl border border-emerald-400/30 bg-brand-surface p-6 shadow-2xl">
                        <h2 id="unblock-title" className="text-xl font-black text-emerald-300">{t('btn_unblock')} · {data.selectedPalletForUnblock.pallet_id}</h2>
                        <p id="unblock-description" className="text-sm text-brand-text-muted">{t('confirm_unblock_message')}</p>
                        <div className="rounded-xl border border-brand-border bg-brand-bg p-4 text-sm">
                            <p className="font-semibold">{data.selectedPalletForUnblock.project} · {data.selectedPalletForUnblock.model}</p>
                            {data.selectedPalletForUnblock.block_reason && <p className="mt-2 break-words text-brand-text-muted">{t('block_reason')}: {data.selectedPalletForUnblock.block_reason}</p>}
                        </div>
                        {data.unblockError && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{data.unblockError}</p>}
                        <div className="flex gap-3 border-t border-brand-border pt-4">
                            <button autoFocus type="button" disabled={status.isSubmitting} onClick={actions.closeUnblock} className="min-h-12 flex-1 rounded-xl border border-brand-border px-4 text-sm font-bold disabled:opacity-50">{t('btn_cancel')}</button>
                            <button type="button" disabled={status.isSubmitting} onClick={() => void actions.handleConfirmUnblock()} className="min-h-12 flex-1 rounded-xl bg-emerald-400 px-4 text-sm font-black text-brand-bg disabled:opacity-50">{status.isSubmitting ? t('saving') : t('btn_unblock')}</button>
                        </div>
                    </section>
                </ModalTransition>}
            </ModalPresence>
            {/* Global Error Modal */}
            <GlobalErrorModal
                isOpen={data.errorModalState.isOpen}
                title={data.errorModalState.title}
                message={data.errorModalState.message}
                onClose={actions.hideGlobalError}
            />
        </div>
    );
};
