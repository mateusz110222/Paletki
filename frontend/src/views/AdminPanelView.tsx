import React, {useEffect} from 'react';
import {AlertCircle, Download, Edit, History, PlusCircle, RefreshCw, ShieldAlert, Trash2, X} from 'lucide-react';
import {TranslationKey, useTranslation} from '../i18n/LanguageContext.tsx';
import {AuditLog, Pallet, PALLET_STATUSES, PalletStatus, Project} from '@backend/shared/types';
import {useAdminPanel} from '../hooks/useAdminPanel.ts';
import {PalletStatusSpan} from "../components/PalletStatusSpan.tsx";
import {GlobalErrorModal} from "../components/GlobalErrorModal.tsx";
import {useSearchParams} from "react-router-dom";
import {SearchInput} from "../components/SearchInput.tsx";

interface AdminPanelViewProps {
    pallets: Pallet[];
    projects: Project[];
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
    const {t} = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedProjectFromUrl = searchParams.get('project') || 'ALL';
    const selectedModelFromUrl = searchParams.get('model') || 'ALL';
    const selectedStatusFromUrl = searchParams.get('status') || 'ALL';
    const searchTermFromURL = searchParams.get('searchTerm') || '';

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


    return (
        <div className="space-y-6" id="admin-panel-container">
            {/* Quick Stats & Actions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Available Card */}
                <div
                    className="bg-brand-surface p-6 rounded-xl border border-brand-border flex flex-col justify-between relative overflow-hidden group hover:border-brand-accent/50 transition-colors">
                    <span
                        className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t('stats_available_pallets')}</span>
                    <span className="text-4xl font-extrabold text-brand-accent mt-2">{data.availableStock}</span>
                    <div className="flex items-center gap-1 text-[10px] text-green-400 mt-2">
                        <span>● {data.avaliblePalletes_Percenetege} % OK</span>
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
                        <span>UR</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="md:col-span-2 flex flex-col gap-3 justify-center">
                    <div className="flex gap-4">
                        <button
                            onClick={() => actions.setIsAddOpen(true)}
                            className="flex-1 bg-brand-accent text-brand-bg font-bold uppercase text-xs h-14 px-6 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all rounded"
                        >
                            <PlusCircle size={18}/>
                            {t('btn_add_pallet')}
                        </button>
                        <button
                            onClick={() => actions.setIsAddProjectOpen(true)}
                            className="flex-1 bg-brand-accent text-brand-bg font-bold uppercase text-xs h-14 px-6 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all rounded"
                        >
                            <PlusCircle size={18}/>
                            {t('btn_add_project')}
                        </button>
                        <button
                            onClick={actions.handleExportAuditTrail}
                            className="flex-1 border border-brand-border text-brand-text font-bold uppercase text-xs h-14 px-6 flex items-center justify-center gap-2 hover:bg-brand-surface-high active:scale-[0.98] transition-all rounded"
                        >
                            <Download size={18}/>
                            {t('btn_export_audit')}
                        </button>
                    </div>

                    <SearchInput searchTermFromURL={searchTermFromURL} searchParams={searchParams} actions={actions}
                                 setSearchParams={setSearchParams}/>
                </div>
            </div>

            {/* Advanced Filters */}
            <div
                className="bg-brand-surface p-4 rounded-xl border border-brand-border flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 items-center">
                    {/* FILTR: PROJEKT */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-brand-text-muted">
                            {t('filter_by_project')}
                        </label>
                        <select
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
                        <label className="text-[10px] uppercase font-bold text-brand-text-muted">
                            {t('filter_by_model')}
                        </label>
                        <select
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
                            {Array.from(new Set(data.pallets.map((p: Pallet) => p.model))).map((projectName) => (
                                <option key={projectName} value={projectName}>{projectName}</option>
                            ))}
                        </select>
                    </div>

                    {/* FILTR: STATUS */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-brand-text-muted">
                            {t('filter_by_status')}
                        </label>
                        <select
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
                        <label className="text-[10px] uppercase font-bold text-brand-text-muted">
                            {t('rows_per_page')}
                        </label>
                        <select
                            value={data.pageSize}
                            onChange={(e) => actions.setPageSize(Number(e.target.value))}
                            className="bg-brand-bg border border-brand-border text-xs rounded p-2 text-brand-text font-medium focus:ring-1 focus:ring-brand-accent"
                        >
                            {[25, 50, 100, 200].map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
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
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('status_all')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted">{t('col_operator')}</th>
                            <th className="px-6 py-3 text-[10px] uppercase font-bold tracking-wider text-brand-text-muted text-right">{t('col_actions')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border">
                        {data.paginatedPallets.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-brand-text-muted">
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
                                                onClick={() => actions.handleOpenAuditModal(p)}
                                                title={t('audit_trail_title')}
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
                                                        FIS: {p.fis ?? 'N/A'}
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
                                                        {p.created_at ? new Date(p.created_at).toLocaleDateString('pl-PL') : 'N/A'}
                                                    </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => actions.handleOpenAuditModal(p)}
                                                    title={t('audit_trail_title')}
                                                    className="p-1 text-brand-text-muted hover:text-brand-accent transition-colors"
                                                >
                                                    <History size={16}/>
                                                </button>

                                                <button
                                                    onClick={() => actions.handleOpenEditModal(p)}
                                                    title={t('btn_edit')}
                                                    className="p-1 text-brand-text-muted hover:text-brand-accent transition-colors"
                                                >
                                                    <Edit size={16}/>
                                                </button>

                                                {p.status === 'Blocked' ? (
                                                    <button
                                                        onClick={() => actions.handleUnblock(p)}
                                                        title={t('btn_unblock')}
                                                        className="text-xs font-bold text-green-400 hover:underline px-1"
                                                    >
                                                        {t('btn_unblock')}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => actions.handleBlockClick(p)}
                                                        title={t('btn_block')}
                                                        className="p-1 text-brand-text-muted hover:text-red-400 transition-colors"
                                                    >
                                                        <ShieldAlert size={16}/>
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => actions.handleDeletePallet(p.pallet_id)}
                                                    title={t('btn_delete')}
                                                    className="p-1 text-brand-text-muted hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={16}/>
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

            {/* MODAL 1: DODAWANIE NOWEJ PALETY */}
            {data.isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    {/* Backdrop z animacją fade-in */}
                    <div
                        className="fixed inset-0 bg-brand-bg/80 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => actions.setIsAddOpen(false)}
                    ></div>

                    {/* Okno Modala z animacją zoom-in */}
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-300">

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
                            >
                                <X size={18}/>
                            </button>
                        </div>

                        <ErrorAlert message={data.validationError}/>

                        {/* Formularz */}
                        <form onSubmit={actions.handleAddPallet} className="p-6 space-y-6">

                            {/* Sekcja główna: ID, Model, Projekt (Siatka 2-kolumnowa) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">
                                        {t('label_pallet_id')}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={t('placeholder_pallet_id')}
                                        value={data.newId.toUpperCase()}
                                        onChange={(e) => actions.setNewId(e.target.value.toUpperCase())}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">
                                        {t('label_model')}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={t('placeholder_model')}
                                        value={data.newModel.toUpperCase()}
                                        onChange={(e) => actions.setNewModel(e.target.value.toUpperCase())}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">
                                        {t('label_project')}
                                    </label>
                                    <select
                                        value={data.newProject}
                                        onChange={(e) => actions.setNewProject(e.target.value)}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all cursor-pointer"
                                        required
                                    >
                                        <option value="">{t('placeholder_select_project')}</option>
                                        {data.projects.map((proj: Project) => {
                                            const name = proj.name
                                            return <option key={name} value={name}>{name}</option>
                                        })}
                                    </select>
                                </div>
                            </div>

                            {/* Sekcja parametrów technicznych: Cykle, Gniazda, FIS */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate">
                                        {t('label_max_cycles')}
                                    </label>
                                    <input
                                        type="number"
                                        value={data.newMaxCycles}
                                        onChange={(e) => actions.setNewMaxCycles(e.target.value)}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all"
                                        required
                                        min="1"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate">
                                        {t('label_nests')}
                                    </label>
                                    <input
                                        type="number"
                                        value={data.newNests}
                                        onChange={(e) => actions.setNewNests(e.target.value)}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all"
                                        required
                                        min="1"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate">
                                        FIS *
                                    </label>
                                    <select
                                        value={data.newFis}
                                        onChange={(e) => actions.setNewFis(e.target.value)}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all cursor-pointer"
                                        required
                                    >
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                    </select>
                                </div>
                            </div>

                            <p className="text-[10px] text-brand-text-muted/60 leading-relaxed italic tracking-wide">
                                {t('validation_required_fields')}
                            </p>

                            {/* Stopka z przyciskami akcji */}
                            <div className="flex gap-4 pt-4 border-t border-brand-border/60">
                                <button
                                    type="button"
                                    onClick={() => actions.setIsAddOpen(false)}
                                    className="flex-1 py-3.5 bg-brand-bg border border-brand-border hover:bg-brand-surface-high hover:border-brand-accent/40 text-brand-text font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-[0.98]"
                                >
                                    {t('btn_cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={status.isSubmitting}
                                    className="flex-1 py-3.5 bg-brand-accent text-brand-bg font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_10px_20px_rgba(59,130,246,0.15)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    {status.isSubmitting ? (
                                        <>
                                            <span
                                                className="w-4 h-4 border-2 border-brand-bg border-t-transparent rounded-full animate-spin"></span>
                                            <span>{t('btn_saving')}</span>
                                        </>
                                    ) : (
                                        <span>{t('btn_save')}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 1B: DODAWANIE NOWEGO PROJEKTU */}
            {data.isAddProjectOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm"
                         onClick={() => actions.setIsAddProjectOpen(false)}></div>
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl">
                        <div
                            className="bg-brand-surface-high p-5 border-b border-brand-border flex justify-between items-center">
                            <h3 className="text-base font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                                <PlusCircle size={18} className="text-brand-accent"/>
                                {t('modal_add_project_title')}
                            </h3>
                            <button className="text-brand-text-muted hover:text-red-400 transition-colors"
                                    onClick={() => actions.setIsAddProjectOpen(false)}>
                                <X size={18}/>
                            </button>
                        </div>

                        <ErrorAlert message={data.validationError}/>

                        <form onSubmit={actions.handleAddProject} className="p-6 space-y-4">

                            <div className="flex flex-col gap-1">
                                <label
                                    className="text-[10px] uppercase font-bold text-brand-text-muted">{t('label_project_name')}</label>
                                <input
                                    type="text"
                                    placeholder={t('placeholder_project_name')}
                                    value={data.newProjectName.toUpperCase()}
                                    onChange={(e) => actions.setNewProjectName(e.target.value.toUpperCase())}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all"
                                    required
                                />
                            </div>

                            <p className="text-[10px] text-brand-text-muted/60 leading-relaxed italic">
                                {t('validation_required_fields')}
                            </p>

                            <div className="flex gap-4 pt-3 border-t border-brand-border">
                                <button
                                    type="button"
                                    onClick={() => actions.setIsAddProjectOpen(false)}
                                    className="flex-1 py-3 border border-brand-border text-brand-text font-bold text-xs uppercase rounded hover:bg-brand-surface-high transition-all"
                                >
                                    {t('btn_cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={status.isSubmitting}
                                    className="flex-1 py-3 bg-brand-accent text-brand-bg font-extrabold text-xs uppercase rounded hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {status.isSubmitting ? t('btn_saving') : t('btn_save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 1C: EDYCJA DANYCH PALETY */}
            {data.isEditOpen && data.selectedPalletForEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div
                        className="fixed inset-0 bg-brand-bg/80 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => actions.setIsEditOpen(false)}
                    ></div>

                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-300">

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
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate">
                                        FIS *
                                    </label>
                                    <select
                                        value={data.editFis}
                                        onChange={(e) => actions.setEditFis(e.target.value)}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all cursor-pointer"
                                        required
                                    >
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate">
                                        {t('label_nests')} *
                                    </label>
                                    <input
                                        type="number"
                                        value={data.editNests}
                                        onChange={(e) => actions.setEditNests(e.target.value)}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all"
                                        required
                                        min="1"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider block truncate">
                                        {t('label_max_cycles')} *
                                    </label>
                                    <input
                                        type="number"
                                        value={data.editMaxCycles}
                                        onChange={(e) => actions.setEditMaxCycles(e.target.value)}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none font-mono transition-all"
                                        required
                                        min="1"
                                    />
                                </div>
                            </div>

                            {/* Sekcja statusu */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">
                                    {t('col_status')} *
                                </label>
                                <select
                                    value={data.editStatus}
                                    onChange={(e) => actions.setEditStatus(e.target.value as PalletStatus)}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all cursor-pointer"
                                    required
                                >
                                    {PALLET_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {t(`status_${status.toLowerCase()}` as TranslationKey)}
                                        </option>))}
                                </select>
                            </div>

                            {/* Powód Blokady (gdy wybrany status to Blocked) */}
                            {data.editStatus === 'Blocked' && (
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">
                                        {t('label_block_reason')} *
                                    </label>
                                    <textarea
                                        value={data.editBlockReason}
                                        onChange={(e) => actions.setEditBlockReason(e.target.value)}
                                        className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                                        rows={3}
                                        placeholder={t('block_reason_required')}
                                        required
                                    />
                                </div>
                            )}

                            {/* Stopka z przyciskami akcji */}
                            <div className="flex gap-4 pt-4 border-t border-brand-border/60">
                                <button
                                    type="button"
                                    onClick={() => actions.setIsEditOpen(false)}
                                    className="flex-1 py-3.5 bg-brand-bg border border-brand-border hover:bg-brand-surface-high hover:border-brand-accent/40 text-brand-text font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-[0.98]"
                                >
                                    {t('btn_cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={status.isSubmitting}
                                    className="flex-1 py-3.5 bg-brand-accent text-brand-bg font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_10px_20px_rgba(59,130,246,0.15)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    {status.isSubmitting ? (
                                        <>
                                            <span
                                                className="w-4 h-4 border-2 border-brand-bg border-t-transparent rounded-full animate-spin"></span>
                                            <span>{t('btn_saving')}</span>
                                        </>
                                    ) : (
                                        <span>{t('btn_save')}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Blokowanie Palety */}
            {data.isBlockOpen && data.selectedPalletForBlock && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div
                        className="bg-brand-surface border border-brand-border rounded-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-brand-border pb-3">
                            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                                <ShieldAlert size={20}/>
                                {t('btn_block')} {data.selectedPalletForBlock.pallet_id}
                            </h3>
                            <button onClick={() => actions.setIsBlockOpen(false)}
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

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => actions.setIsBlockOpen(false)}
                                    className="px-4 py-2 border border-brand-border text-xs font-bold uppercase rounded text-brand-text hover:bg-brand-surface-high"
                                >
                                    {t('btn_cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={status.isSubmitting}
                                    className="px-4 py-2 bg-red-500 text-white text-xs font-bold uppercase rounded hover:bg-red-600 disabled:opacity-50"
                                >
                                    {status.isSubmitting ? t('saving') : t('btn_block')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Audit Trail (Historia życia palety) */}
            {data.selectedPalletForAudit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm"
                        onClick={() => actions.setSelectedPalletForAudit(null)}
                    ></div>

                    {/* Modal Content */}
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                        {/* Header */}
                        <div
                            className="bg-brand-surface-high p-5 border-b border-brand-border flex justify-between items-center">
                            <div className="flex items-center gap-2 text-brand-accent">
                                <History size={18}/>
                                <h3 className="text-base font-bold">{t("audit_trail_title")}</h3>
                            </div>
                            <button
                                className="text-brand-text-muted hover:text-red-400 transition-colors"
                                onClick={() => actions.setSelectedPalletForAudit(null)}
                            >
                                <X size={18}/>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4 max-h-120 overflow-y-auto">

                            {/* Pallet Info Card */}
                            <div
                                className="flex flex-wrap gap-4 justify-between items-center bg-brand-bg p-3 rounded border border-brand-border">
                                <div>
                                    <span
                                        className="text-[10px] uppercase font-bold text-brand-text-muted block">{t("pallet_id_label")}</span>
                                    <span
                                        className="font-mono text-sm font-bold text-brand-accent">{data.selectedPalletForAudit.pallet_id || data.selectedPalletForAudit.id}</span>
                                </div>
                                <div>
                                    <span
                                        className="text-[10px] uppercase font-bold text-brand-text-muted block">{t("project_model")}</span>
                                    <span
                                        className="text-xs font-semibold text-brand-text">{data.selectedPalletForAudit.project} {data.selectedPalletForAudit.model ? `(${data.selectedPalletForAudit.model})` : ''}</span>
                                </div>
                                <div>
                                    <span
                                        className="text-[10px] uppercase font-bold text-brand-text-muted block">{t("col_total_cycles")}</span>
                                    <span
                                        className="font-mono text-xs font-semibold text-brand-text">{data.selectedPalletForAudit.total_cycles || 0} cykli</span>
                                </div>
                            </div>

                            {/* Timeline Space */}
                            <div
                                className="overflow-y-auto space-y-4 pr-2 flex-1 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-brand-border">

                                {(!data.selectedPalletForAudit.history || data.selectedPalletForAudit.history.length === 0) ? (
                                    <div className="relative pl-10 py-4">
                                        <p className="text-sm text-brand-text-muted text-center bg-brand-surface-high/30 p-4 rounded border border-brand-border dashed">
                                            {t("no_history_entries")}
                                        </p>
                                    </div>
                                ) : (
                                    data.selectedPalletForAudit.history.map((entry: AuditLog) => (
                                        <div key={entry.id} className="relative pl-10">

                                            <div
                                                className="absolute left-2.5 top-1.5 w-3.5 h-3.5 bg-brand-surface border-2 border-brand-accent rounded-full z-10 flex items-center justify-center">
                                                <div className="w-1 h-1 bg-brand-accent rounded-full"></div>
                                            </div>

                                            <div
                                                className="bg-brand-surface-high/50 p-4 rounded border border-brand-border space-y-2">
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="text-xs font-bold text-brand-accent uppercase">
                                                        {entry.previous_status === entry.new_status ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{t("status_on_modification")}</span>
                                                                <PalletStatusSpan
                                                                    status={entry.previous_status as PalletStatus}
                                                                    block_reason={entry?.description}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                {t("status_change")}
                                                                <PalletStatusSpan
                                                                    status={entry.previous_status as PalletStatus}
                                                                    block_reason={entry?.description}
                                                                />
                                                                <span>➔</span>
                                                                <PalletStatusSpan
                                                                    status={entry.new_status as PalletStatus}
                                                                    block_reason={entry?.description}
                                                                />
                                                            </div>
                                                        )}
                                                    </span>
                                                    <span
                                                        className="text-[10px] font-mono text-brand-text-muted whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('pl-PL')}</span>
                                                </div>

                                                {entry.description && (
                                                    <p className="text-xs text-brand-text leading-relaxed">
                                                        {entry.description}
                                                    </p>
                                                )}

                                                <div
                                                    className="flex justify-between items-center text-[10px] text-brand-text-muted border-t border-brand-border/40 pt-1">
                                                    <span>
                                                        Operator: <strong
                                                        className="text-brand-text">{entry.operator_id}</strong>
                                                    </span>
                                                    {entry.id && <span>Log ID: {entry.id}</span>}
                                                </div>
                                            </div>

                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-brand-surface-high p-4 border-t border-brand-border text-right"></div>

                    </div>
                </div>
            )}

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