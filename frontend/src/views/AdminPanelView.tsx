import React, {useEffect} from 'react';
import {
    AlertCircle,
    Copy,
    Download,
    Edit,
    History,
    PlusCircle,
    RefreshCw,
    RotateCcw,
    ShieldAlert,
    Trash2,
    X
} from 'lucide-react';
import {TranslationKey, useTranslation} from '../i18n/LanguageContext.tsx';
import {Pallet, PalletModel, PALLET_STATUSES, PalletStatus, Project} from '@backend/shared/types';
import {useAdminPanel} from '../hooks/useAdminPanel.ts';
import {PalletStatusSpan} from "../components/PalletStatusSpan.tsx";
import {GlobalErrorModal} from "../components/GlobalErrorModal.tsx";
import {useNavigate, useSearchParams} from "react-router-dom";
import {SearchInput} from "../components/SearchInput.tsx";
import {useEscapeKey} from "../hooks/useEscapeKey.ts";
import {ModalFormActions} from "../components/ModalFormActions.tsx";
import {ModalPresence, ModalTransition} from '../components/ModalTransition.tsx';
import {InputField, SelectField, TextareaField} from '../components/FormFields.tsx';
import {Pagination} from '../components/Pagination.tsx';

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
    const {t, language} = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedProjectFromUrl = searchParams.get('project') || 'ALL';
    const selectedModelFromUrl = searchParams.get('model') || 'ALL';
    const selectedStatusFromUrl = searchParams.get('status') || 'ALL';
    const searchTermFromURL = searchParams.get('searchTerm') || '';
    const hasActiveFilters = selectedProjectFromUrl !== 'ALL' || selectedModelFromUrl !== 'ALL' ||
        selectedStatusFromUrl !== 'ALL' || Boolean(searchTermFromURL);
    const isAddPalletValid = Boolean(
        data.newId.trim() &&
        (data.addMode === 'single' || data.newLastId.trim()) &&
        data.newProject &&
        data.newModel &&
        Number(data.newMaxCycles) > 0 &&
        Number(data.newNests) > 0 &&
        data.newFis,
    );
    const isAddProjectValid = Boolean(data.newProjectName.trim());
    const isAddModelValid = Boolean(data.newModelProject && data.newModelName.trim());
    const openPalletHistory = (pallet: Pallet) => {
        navigate(`/admin/pallets/${encodeURIComponent(pallet.pallet_id)}/history`);
    };

    const clearFilters = () => {
        const nextParams = new URLSearchParams(searchParams);
        ['project', 'model', 'status', 'searchTerm'].forEach((key) => nextParams.delete(key));
        setSearchParams(nextParams);
        actions.setSelectedProject('ALL');
        actions.setSelectedModel('ALL');
        actions.setSelectedStatus('ALL');
        actions.setSearchTerm('');
    };

    useEffect(() => {
        actions.setSelectedProject(selectedProjectFromUrl);
    }, [actions, selectedProjectFromUrl]);

    useEffect(() => {
        actions.setSelectedModel(selectedModelFromUrl);
    }, [actions, selectedModelFromUrl]);

    useEffect(() => {
        actions.setSelectedStatus(selectedStatusFromUrl);
    }, [actions, selectedStatusFromUrl]);

    useEffect(() => {
        actions.setSearchTerm(searchTermFromURL);
    }, [actions, searchTermFromURL]);

    const hasOpenModal = data.errorModalState.isOpen || data.selectedPalletForDelete !== null ||
        data.isBlockOpen || data.isEditOpen || data.isAddProjectOpen || data.isAddModelOpen || data.isAddOpen;

    useEscapeKey(hasOpenModal, () => {
        if (data.errorModalState.isOpen) {
            actions.hideGlobalError();
        } else if (!status.isSubmitting && data.selectedPalletForDelete) {
            actions.setSelectedPalletForDelete(null);
        } else if (!status.isSubmitting && data.isBlockOpen) {
            actions.setIsBlockOpen(false);
        } else if (!status.isSubmitting && data.isEditOpen) {
            actions.setIsEditOpen(false);
        } else if (!status.isSubmitting && data.isAddProjectOpen) {
            actions.setIsAddProjectOpen(false);
        } else if (!status.isSubmitting && data.isAddModelOpen) {
            actions.setIsAddModelOpen(false);
        } else if (!status.isSubmitting && data.isAddOpen) {
            actions.setIsAddOpen(false);
        }
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" id="admin-panel-container">
            {/* Quick Stats & Actions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Available Card */}
                <div
                    className="bg-brand-surface p-6 rounded-xl border border-brand-border flex flex-col justify-between relative overflow-hidden group hover:border-brand-accent/50 transition-colors">
                    <span
                        className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t('stats_available_pallets')}</span>
                    <span className="text-4xl font-extrabold text-brand-accent mt-2">{data.availableStock}</span>
                    <div className="flex items-center gap-1 text-[10px] text-green-400 mt-2">
                        <span>● {data.avaliblePalletes_Percenetege} % {t('availability_ok_suffix')}</span>
                    </div>
                </div>

                {/* Blocked / Maint Card */}
                <div
                    className="bg-brand-surface p-6 rounded-xl border border-brand-border flex flex-col justify-between relative overflow-hidden group hover:border-brand-accent/50 transition-colors">
                    <span
                        className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t('stats_service_blocked')}</span>
                    <span className="text-4xl font-extrabold text-red-400 mt-2">{data.blockedOrMaint}</span>
                    <div className="flex items-center gap-1 text-[10px] text-red-400 mt-2">
                        <ShieldAlert size={12}/>
                        <span>{t('maintenance_abbreviation')}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="md:col-span-2 flex flex-col gap-3 justify-center">
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <button
                            onClick={actions.handleOpenAddPallet}
                            className="flex-1 bg-brand-accent text-brand-bg font-bold uppercase text-xs h-14 px-6 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all rounded"
                        >
                            <PlusCircle size={18}/>
                            {t('btn_add_pallet')}
                        </button>
                        <button
                            onClick={() => actions.setIsAddProjectOpen(true)}
                            className="flex-1 border border-brand-accent/50 bg-brand-accent/10 text-brand-accent font-bold uppercase text-xs h-14 px-6 flex items-center justify-center gap-2 hover:bg-brand-accent/20 active:scale-[0.98] transition-all rounded"
                        >
                            <PlusCircle size={18}/>
                            {t('btn_add_project')}
                        </button>
                        <button
                            onClick={() => actions.setIsAddModelOpen(true)}
                            className="flex-1 border border-brand-accent/50 bg-brand-accent/10 text-brand-accent font-bold uppercase text-xs h-14 px-6 flex items-center justify-center gap-2 hover:bg-brand-accent/20 active:scale-[0.98] transition-all rounded"
                        >
                            <PlusCircle size={18}/>
                            {t('btn_add_model')}
                        </button>
                        <button
                            onClick={actions.handleExportAuditTrail}
                            className="flex-1 border border-brand-border text-brand-text font-bold uppercase text-xs h-14 px-6 flex items-center justify-center gap-2 hover:bg-brand-surface-high active:scale-[0.98] transition-all rounded"
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
                        <label htmlFor="admin-filter-project" className="text-[10px] uppercase font-bold text-brand-text-muted">
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
                        <label htmlFor="admin-filter-model" className="text-[10px] uppercase font-bold text-brand-text-muted">
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
                            <span id="admin-filter-model-hint" className="max-w-40 text-[9px] leading-tight text-brand-text-muted">
                                {t('filter_model_hint')}
                            </span>
                        )}
                    </div>

                    {/* FILTR: STATUS */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="admin-filter-status" className="text-[10px] uppercase font-bold text-brand-text-muted">
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
                        <label htmlFor="admin-page-size" className="text-[10px] uppercase font-bold text-brand-text-muted">
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
                        className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded border border-brand-border px-3 text-[10px] font-bold uppercase tracking-wider text-brand-text-muted transition-colors hover:border-brand-accent hover:text-brand-accent disabled:cursor-not-allowed disabled:opacity-30"
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
                    className="px-6 py-4 border-b border-brand-border flex justify-between items-center bg-brand-surface/50">
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
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                        <tr className="bg-brand-surface-high/30 border-b border-brand-border text-left">
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('col_pallet_id')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('col_project')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('col_model')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('col_fis')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('col_cycles')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('col_status')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('col_operator')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted text-right">{t('col_actions')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border">
                        {data.paginatedPallets.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-10 text-center text-brand-text-muted">
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
                                    <tr key={p.pallet_id} className="hover:bg-brand-surface-high/30 transition-colors">
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
                                        <td className="px-6 py-4 text-xs font-medium text-brand-text">{p.project}</td>
                                        <td className="px-6 py-4 text-xs font-medium text-brand-text">{p.model}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                    <span
                                                        className="bg-brand-surface-high text-[9px] px-2 py-0.5 rounded border border-brand-border font-mono text-brand-text">
                                                        FIS: {p.fis ?? t('value_not_available')}
                                                    </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-32 flex flex-col gap-1">
                                                <div className="flex justify-between text-[10px] font-mono">
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
                                        <td className="px-6 py-4">
                                            <PalletStatusSpan status={p.status as PalletStatus}
                                                              block_reason={p.block_reason}/>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                    <span
                                                        className="text-xs font-medium text-brand-text">{p.created_by}</span>
                                                <span className="text-[9px] text-brand-text-muted font-mono">
                                                        {p.created_at ? new Date(p.created_at).toLocaleDateString(language) : t('value_not_available')}
                                                    </span>
                                            </div>
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
                                                        <span className="hidden 2xl:inline text-[10px] font-bold uppercase">{t('btn_block')}</span>
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
                                                    <span className="hidden 2xl:inline text-[10px] font-bold uppercase">{t('btn_delete')}</span>
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

                        <ErrorAlert message={data.validationError}/>

                        {/* Formularz */}
                        <form onSubmit={actions.handleAddPallet} className="p-6 space-y-6">

                            <div className="grid grid-cols-2 gap-2 rounded-xl border border-brand-border bg-brand-bg p-1.5">
                                <button
                                    type="button"
                                    onClick={() => actions.setAddMode('single')}
                                    className={`rounded-lg px-3 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors ${data.addMode === 'single' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted hover:text-brand-text'}`}
                                >
                                    {t('add_mode_single')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => actions.setAddMode('range')}
                                    className={`rounded-lg px-3 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors ${data.addMode === 'range' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted hover:text-brand-text'}`}
                                >
                                    {t('add_mode_range')}
                                </button>
                            </div>

                            {/* Sekcja główna: ID i Projekt, zależny Model poniżej na całą szerokość */}
                            <div className="grid grid-cols-2 gap-4">
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
                                    fieldClassName={data.addMode === 'range' ? 'flex flex-col gap-1.5 col-span-2' : undefined}
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

                                {data.addMode === 'range' && (
                                    <p className="col-span-2 -mt-1 text-[10px] leading-relaxed text-brand-text-muted">
                                        {t('pallet_range_hint')}
                                    </p>
                                )}

                                <SelectField
                                    label={t('label_model')}
                                    fieldClassName="flex flex-col gap-1.5 col-span-2"
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
                                    labelClassName="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    type="number"
                                    value={data.newMaxCycles}
                                    onChange={(e) => actions.setNewMaxCycles(e.target.value)}
                                    required
                                    min="1"
                                />

                                <InputField
                                    label={t('label_nests')}
                                    labelClassName="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    type="number"
                                    value={data.newNests}
                                    onChange={(e) => actions.setNewNests(e.target.value)}
                                    required
                                    min="1"
                                />

                                <SelectField
                                    label={t('label_fis')}
                                    labelClassName="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    monospace
                                    value={data.newFis}
                                    onChange={(e) => actions.setNewFis(e.target.value)}
                                    required
                                >
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                </SelectField>
                            </div>

                            <p className="text-[10px] text-brand-text-muted leading-relaxed tracking-wide">
                                {t('required_fields_hint')}
                            </p>

                            {/* Stopka z przyciskami akcji */}
                            <ModalFormActions
                                onCancel={() => actions.setIsAddOpen(false)}
                                submitLabel={t('btn_save')}
                                isSubmitting={status.isSubmitting}
                                submitDisabled={!isAddPalletValid}
                            />
                        </form>
                    </div>
                </ModalTransition>
            )}
            </ModalPresence>

            {/* MODAL 1B: DODAWANIE NOWEGO PROJEKTU */}
            <ModalPresence>
            {data.isAddProjectOpen && (
                <ModalTransition onBackdropClick={() => actions.setIsAddProjectOpen(false)}>
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl">
                        <div
                            className="bg-brand-surface-high p-5 border-b border-brand-border flex justify-between items-center">
                            <h3 className="text-base font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                                <PlusCircle size={18} className="text-brand-accent"/>
                                {t('modal_add_project_title')}
                            </h3>
                            <button className="text-brand-text-muted hover:text-red-400 transition-colors"
                                    aria-label={t('btn_cancel')}
                                    onClick={() => actions.setIsAddProjectOpen(false)}>
                                <X size={18}/>
                            </button>
                        </div>

                        <ErrorAlert message={data.validationError}/>

                        <form onSubmit={actions.handleAddProject} className="p-6 space-y-4">

                            <InputField
                                label={t('label_project_name')}
                                fieldClassName="flex flex-col gap-1"
                                labelClassName="text-[10px] uppercase font-bold text-brand-text-muted"
                                type="text"
                                autoFocus
                                placeholder={t('placeholder_project_name')}
                                value={data.newProjectName.toUpperCase()}
                                onChange={(e) => actions.setNewProjectName(e.target.value.toUpperCase())}
                                required
                            />

                            <p className="text-[10px] text-brand-text-muted leading-relaxed">
                                {t('required_fields_hint')}
                            </p>

                            <ModalFormActions
                                onCancel={() => actions.setIsAddProjectOpen(false)}
                                submitLabel={t('btn_save')}
                                isSubmitting={status.isSubmitting}
                                submitDisabled={!isAddProjectValid}
                            />
                        </form>
                    </div>
                </ModalTransition>
            )}
            </ModalPresence>

            {/* MODAL 1B2: DODAWANIE NOWEGO MODELU */}
            <ModalPresence>
            {data.isAddModelOpen && (
                <ModalTransition onBackdropClick={() => actions.setIsAddModelOpen(false)}>
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl">
                        <div
                            className="bg-brand-surface-high p-5 border-b border-brand-border flex justify-between items-center">
                            <h3 className="text-base font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                                <PlusCircle size={18} className="text-brand-accent"/>
                                {t('modal_add_model_title')}
                            </h3>
                            <button className="text-brand-text-muted hover:text-red-400 transition-colors"
                                    type="button"
                                    aria-label={t('btn_cancel')}
                                    onClick={() => actions.setIsAddModelOpen(false)}>
                                <X size={18}/>
                            </button>
                        </div>

                        <ErrorAlert message={data.validationError}/>

                        <form onSubmit={actions.handleAddModel} className="p-6 space-y-4">
                            <SelectField
                                label={t('label_model_project')}
                                value={data.newModelProject}
                                onChange={(e) => actions.setNewModelProject(e.target.value)}
                                required
                            >
                                <option value="">{t('placeholder_select_project')}</option>
                                {data.projects.map((project: Project) => (
                                    <option key={project.name} value={project.name}>{project.name}</option>
                                ))}
                            </SelectField>

                            <InputField
                                label={t('label_model_name')}
                                type="text"
                                autoFocus
                                placeholder={t('placeholder_model_name')}
                                value={data.newModelName.toUpperCase()}
                                onChange={(e) => actions.setNewModelName(e.target.value.toUpperCase())}
                                required
                            />

                            <p className="text-[10px] text-brand-text-muted leading-relaxed">
                                {t('required_fields_hint')}
                            </p>

                            <ModalFormActions
                                onCancel={() => actions.setIsAddModelOpen(false)}
                                submitLabel={t('btn_save')}
                                isSubmitting={status.isSubmitting}
                                submitDisabled={!isAddModelValid}
                            />
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
                                        className="text-[10px] uppercase font-bold text-brand-text-muted block">{t('col_pallet_id')}</span>
                                    <span
                                        className="font-mono text-xs font-bold text-brand-accent">{data.selectedPalletForEdit.pallet_id}</span>
                                </div>
                                <div>
                                    <span
                                        className="text-[10px] uppercase font-bold text-brand-text-muted block">{t('col_project')}</span>
                                    <span
                                        className="text-xs font-semibold text-brand-text">{data.selectedPalletForEdit.project}</span>
                                </div>
                                <div>
                                    <span
                                        className="text-[10px] uppercase font-bold text-brand-text-muted block">{t('col_model')}</span>
                                    <span
                                        className="text-xs font-semibold text-brand-text">{data.selectedPalletForEdit.model}</span>
                                </div>
                            </div>

                            {/* Sekcja parametrów technicznych: FIS, Gniazda (nests), Limit Cykli (max_cycles) */}
                            <div className="grid grid-cols-3 gap-3">
                                <SelectField
                                    label={t('label_fis')}
                                    labelClassName="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
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
                                    labelClassName="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
                                    type="number"
                                    value={data.editNests}
                                    onChange={(e) => actions.setEditNests(e.target.value)}
                                    required
                                    min="1"
                                />

                                <InputField
                                    label={<>{t('label_max_cycles')} *</>}
                                    labelClassName="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate"
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
