import React, {useEffect} from 'react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    CheckSquare,
    FileText,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    User,
    Wrench,
    X
} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {Pallet} from '@backend/shared/types';
import {useMaintenancePanel} from '../hooks/useMaintenancePanel.ts';
import {useSearchParams} from "react-router-dom";
import {SearchInput} from "../components/SearchInput.tsx";

interface MaintenancePanelViewProps {
    pallets: Pallet[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
}

export const MaintenancePanelView: React.FC<MaintenancePanelViewProps> = (props) => {
    const {data, actions} = useMaintenancePanel(props);
    const {t} = useTranslation();

    const [searchParams, setSearchParams] = useSearchParams();
    const searchTermFromURL = searchParams.get('searchTerm') || '';

    useEffect(() => {
        actions.setSearchTerm(searchTermFromURL);
    }, [actions, searchTermFromURL]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300" id="maintenance-panel-container">
            {/* Top statistics section in Bento Grid Style */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div
                    className="md:col-span-1 bg-brand-surface p-6 rounded-xl border-l-4 border-brand-accent border-y border-r flex flex-col justify-between">
                    <span
                        className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{t('maintenance_queue')}</span>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span
                            className="text-4xl font-black text-brand-text">{data.repairPallets.length + data.routinePallets.length}</span>
                        <span className="text-xs font-bold text-brand-text-muted">{t('pallets_count')}</span>
                    </div>
                    <div
                        className="mt-4 py-1 px-2 bg-brand-accent/10 border border-brand-accent/20 rounded inline-flex items-center gap-2 w-fit">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse"></div>
                        <span className="text-[9px] font-bold text-brand-accent uppercase">{t('priority_high')}</span>
                    </div>
                </div>

                <div
                    className="md:col-span-1 bg-brand-surface p-6 rounded-xl border border-brand-border flex flex-col justify-between">
                    <span
                        className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{t('for_repair')}</span>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-4xl font-black text-red-500">{data.repairPallets.length}</span>
                        <div className="flex flex-col">
                            <span
                                className="text-[10px] font-bold text-red-500/70 uppercase leading-tight">{t('intervention_required_line1')}</span>
                            <span
                                className="text-[10px] font-bold text-red-500/70 uppercase leading-tight">{t('intervention_required_line2')}</span>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-red-500"/>
                        <span
                            className="text-[10px] font-medium text-brand-text-muted italic">{t('reported_damage')}</span>
                    </div>
                </div>

                <div
                    className="md:col-span-1 bg-brand-surface p-6 rounded-xl border border-brand-border flex flex-col justify-between">
                    <span
                        className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{t('routine_inspections')}</span>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-4xl font-black text-yellow-500">{data.routinePallets.length}</span>
                        <div className="flex flex-col">
                            <span
                                className="text-[10px] font-bold text-yellow-500/70 uppercase leading-tight">{t('awaiting_service_line1')}</span>
                            <span
                                className="text-[10px] font-bold text-yellow-500/70 uppercase leading-tight">{t('awaiting_service_line2')}</span>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                        <RefreshCw size={14} className="text-yellow-500"/>
                        <span
                            className="text-[10px] font-medium text-brand-text-muted italic">{t('cycle_limit_exceeded')}</span>
                    </div>
                </div>

                <div
                    className="md:col-span-1 bg-brand-surface p-6 rounded-xl border border-brand-border flex flex-col justify-between">
                    <span
                        className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{t('technician_status')}</span>
                    <div className="flex items-center gap-3 mt-2">
                        <div
                            className="w-10 h-10 rounded-full bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center">
                            <User className="text-brand-accent" size={20}/>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-brand-text">{data.Operator}</p>
                            <p className="text-[10px] font-medium text-green-400">{t('online_active')}</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-brand-accent"/>
                        <span
                            className="text-[10px] font-medium text-brand-text-muted italic">{t('service_permissions_ok')}</span>
                    </div>
                </div>
            </div>

            <SearchInput searchTermFromURL={searchTermFromURL} searchParams={searchParams} actions={actions}
                         setSearchParams={setSearchParams}/>

            {/* Main Work Area */}
            <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
                {/* Custom Tabs */}
                <div className="flex border-b border-brand-border bg-brand-surface-high/30">
                    <button
                        onClick={() => actions.setActiveTab('repairs')}
                        className={`flex-1 py-4 px-6 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${data.activeTab === 'repairs'
                            ? 'bg-brand-surface text-brand-accent border-b-2 border-brand-accent'
                            : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-high/50'
                        }`}
                    >
                        <AlertCircle size={16}/>
                        {t('repairs_tab')}
                        {data.filteredRepairPallets.length > 0 && (
                            <span
                                className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[9px] rounded-full">{data.filteredRepairPallets.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => actions.setActiveTab('routine')}
                        className={`flex-1 py-4 px-6 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${data.activeTab === 'routine'
                            ? 'bg-brand-surface text-brand-accent border-b-2 border-brand-accent'
                            : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-high/50'
                        }`}
                    >
                        <Wrench size={16}/>
                        {t('routine_tab')}
                        {data.filteredRoutinePallets.length > 0 && (
                            <span
                                className="ml-2 px-1.5 py-0.5 bg-yellow-500 text-brand-bg text-[9px] rounded-full">{data.filteredRoutinePallets.length}</span>
                        )}
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(data.activeTab === 'repairs' ? data.filteredRepairPallets : data.filteredRoutinePallets).map((p: Pallet) => (
                            <div
                                key={p.pallet_id}
                                className="bg-brand-bg border border-brand-border rounded-lg p-5 hover:border-brand-accent/40 transition-all group flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div
                                            className="px-2 py-1 bg-brand-surface-high border border-brand-border rounded font-mono text-xs font-bold text-brand-accent">
                                            {p.pallet_id}
                                        </div>
                                        {data.activeTab === 'repairs' ? (
                                            <span
                                                className="text-[10px] font-black text-red-500 uppercase flex items-center gap-1">
                                                <AlertTriangle size={12}/> {t('damaged_status')}
                                            </span>
                                        ) : (
                                            <span
                                                className="text-[10px] font-black text-yellow-500 uppercase flex items-center gap-1">
                                                <RefreshCw size={12}/> {t('cyclic_service')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div>
                                            <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-tighter">{t('project_model')}</p>
                                            <p className="text-xs font-bold text-brand-text">{p.project} • {p.model}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-tighter">{t('mileage')}</p>
                                            <p className="text-xs font-mono font-bold text-brand-text">
                                                {p.current_cycles} <span
                                                className="text-brand-text-muted/60">/ {p.max_cycles}</span>
                                            </p>
                                        </div>
                                        {p.block_reason && (
                                            <div className="p-2 bg-red-500/5 border border-red-500/20 rounded">
                                                <p className="text-[10px] font-bold text-red-400 uppercase mb-1 flex items-center gap-1">
                                                    <FileText size={10}/> {t('reason_for_reporting')}:
                                                </p>
                                                <p className="text-[11px] text-brand-text leading-tight italic">"{p.block_reason}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => actions.handleOpenServiceLog(p)}
                                    className="w-full py-3 bg-brand-surface-high border border-brand-border text-brand-text font-black text-[10px] uppercase tracking-widest rounded hover:bg-brand-accent hover:text-brand-bg hover:border-brand-accent transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckSquare size={14}/>
                                    {t('start_servicing')}
                                </button>
                            </div>
                        ))}

                        {(data.activeTab === 'repairs' ? data.filteredRepairPallets : data.filteredRoutinePallets).length === 0 && (
                            <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
                                <div
                                    className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                                    <CheckCircle2 size={32}/>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-brand-text">{t('queue_empty')}</p>
                                    <p className="text-xs text-brand-text-muted mt-1">{t('all_pallets_ok')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SERVICE LOG MODAL */}
            {data.selectedPallet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-brand-bg/80 backdrop-blur-md"
                         onClick={() => actions.setSelectedPallet(null)}></div>
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-xl rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        {/* Modal Header */}
                        <div
                            className="bg-brand-surface-high p-6 border-b border-brand-border flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl bg-brand-accent/20 flex items-center justify-center">
                                    <Wrench className="text-brand-accent" size={24}/>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-brand-text uppercase tracking-tight">{t('service_protocol')}</h3>
                                    <p className="text-xs text-brand-text-muted font-mono">{t('pallet_id_label')}: <span
                                        className="text-brand-accent font-bold">{data.selectedPallet.pallet_id}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                className="w-10 h-10 rounded-full flex items-center justify-center text-brand-text-muted hover:bg-red-500/10 hover:text-red-400 transition-all"
                                onClick={() => actions.setSelectedPallet(null)}
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={actions.handleReturnToProduction} className="p-8 space-y-6">
                            {data.modalError && (
                                <div
                                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 animate-in shake duration-300">
                                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18}/>
                                    <p className="text-xs font-bold text-red-400 leading-tight">{data.modalError}</p>
                                </div>
                            )}

                            {/* Maintenance Tasks Checklist */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest mb-2">{t('required_service_activities')}</p>

                                <label
                                    className="flex items-center gap-4 p-4 bg-brand-bg border border-brand-border rounded-xl cursor-pointer hover:border-brand-accent/40 transition-all group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={data.washConfirm}
                                            onChange={(e) => actions.setWashConfirm(e.target.checked)}
                                            className="peer h-6 w-6 opacity-0 absolute cursor-pointer"
                                        />
                                        <div
                                            className={`h-6 w-6 rounded-md transition-all flex items-center justify-center border-2 ${data.washConfirm
                                                ? 'bg-brand-accent border-brand-accent'
                                                : 'bg-brand-surface border-brand-border'
                                            }`}
                                        >
                                            <Sparkles
                                                size={14}
                                                className={`text-white transition-transform ${data.washConfirm ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <span
                                            className="text-xs font-bold text-brand-text block">{t('ultrasonic_washing')}</span>
                                        <span
                                            className="text-[10px] text-brand-text-muted">{t('remove_contaminants')}</span>
                                    </div>
                                </label>

                                <label
                                    className="flex items-center gap-4 p-4 bg-brand-bg border border-brand-border rounded-xl cursor-pointer hover:border-brand-accent/40 transition-all group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={data.fluxConfirm}
                                            onChange={(e) => actions.setFluxConfirm(e.target.checked)}
                                            className="peer h-6 w-6 opacity-0 absolute cursor-pointer z-10"
                                        />
                                        <div
                                            className={`h-6 w-6 rounded-md transition-all flex items-center justify-center border-2 ${data.fluxConfirm
                                                ? 'bg-brand-accent border-brand-accent'
                                                : 'bg-brand-surface border-brand-border'
                                            }`}
                                        >
                                            <Sparkles
                                                size={14}
                                                className={`text-white transition-transform ${data.fluxConfirm ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <span
                                            className="text-xs font-bold text-brand-text block">{t('flux_residue_inspection')}</span>
                                        <span
                                            className="text-[10px] text-brand-text-muted">{t('verify_pin_cleanliness')}</span>
                                    </div>
                                </label>
                            </div>

                            {/* Work Description */}
                            <div className="space-y-2">
                                <label
                                    className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">{t('detailed_work_description')}</label>
                                <textarea
                                    rows={3}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                                    placeholder={t('service_description_placeholder')}
                                    value={data.repairDescription}
                                    onChange={(e) => actions.setRepairDescription(e.target.value)}
                                ></textarea>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="w-full py-4 bg-brand-accent text-brand-bg font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={18}/>
                                {t('approve_service_and_return')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};