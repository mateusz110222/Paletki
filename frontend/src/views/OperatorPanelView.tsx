import React from 'react';
import {createPortal} from 'react-dom';
import { AlertTriangle, Box, ChevronRight, Edit3, Layers, Scan, WashingMachine, X } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { Pallet, PalletStatus } from '@backend/shared/types';
import { useOperatorPanel } from '../hooks/useOperatorPanel.ts';
import { PalletStatusSpan } from "../components/PalletStatusSpan.tsx";
import { GlobalErrorModal } from "../components/GlobalErrorModal.tsx";
import { useEscapeKey } from "../hooks/useEscapeKey.ts";
import { ModalFormActions } from "../components/ModalFormActions.tsx";
import {ModalPresence, ModalTransition} from '../components/ModalTransition.tsx';

interface OperatorPanelViewProps {
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
}

export const OperatorPanelView: React.FC<OperatorPanelViewProps> = (props) => {
    const { data, actions } = useOperatorPanel(props);
    const { t } = useTranslation();

    const currentCycles = data.activePallet?.current_cycles ?? 0;
    const maxCycles = data.activePallet?.max_cycles || 1;
    const cyclePercentage = Math.min(100, Math.round((currentCycles / maxCycles) * 100));

    useEscapeKey(data.errorModalState.isOpen || data.isOtherFaultOpen, () => {
        if (data.errorModalState.isOpen) {
            actions.hideGlobalError();
        } else if (!data.isSubmitting) {
            actions.setIsOtherFaultOpen(false);
        }
    });

    const getProgressColor = (percent: number) => {
        if (percent >= 90) return 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
        if (percent >= 75) return 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
        return 'bg-brand-accent shadow-[0_0_12px_rgba(59,130,246,0.3)]';
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        actions.setScannedId(e.target.value.toUpperCase());
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" id="operator-panel-container">
            {/* 1. SEKCJA SKANERA (Gdy brak aktywnej palety) */}
            {!data.activePallet && (
                <section
                    className="bg-brand-surface border border-brand-border/80 rounded-2xl overflow-hidden shadow-2xl relative">
                    <div
                        className={`h-1.5 transition-colors duration-500 ${data.scanStatus === 'SUCCESS' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : data.scanStatus === 'ERROR' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-brand-accent/40'
                            }`}
                    ></div>

                    <div className="p-8 md:p-14 flex flex-col items-center text-center space-y-6">
                        <div
                            className={`w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300 border ${data.scanStatus === 'SUCCESS'
                                ? 'bg-green-500/10 border-green-500/40 text-green-400 scale-105'
                                : data.scanStatus === 'ERROR'
                                    ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-bounce'
                                    : 'bg-brand-accent/10 border-brand-accent/20 text-brand-accent'
                                }`}
                        >
                            <Scan size={48} className="animate-pulse" />
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-3xl font-black text-brand-text uppercase tracking-tight">{t('op_scanner_title')}</h2>
                            <p className="text-brand-text-muted text-sm font-medium">{t('op_scanner_subtitle')}</p>
                        </div>

                        <form id={"scanner-form"} onSubmit={(e) => actions.handleScanSubmit(e)}
                            className="w-full max-w-md space-y-3">
                            <div className="relative">
                                <input
                                    ref={actions.barcodeInputRef}
                                    type="text"
                                    value={data.scannedId || ''}
                                    onChange={handleInputChange}
                                    className="w-full bg-brand-bg/80 border-2 border-brand-border rounded-xl py-4 px-6 text-2xl font-mono font-black text-brand-accent focus:ring-4 focus:ring-brand-accent/10 outline-none transition-all text-center tracking-widest uppercase shadow-inner"
                                    placeholder={t('op_scan_placeholder')}
                                    autoComplete="off"
                                />
                            </div>
                            <button type="submit" className="hidden">{t('btn_scan')}</button>

                            <div
                                className="flex items-center justify-center gap-2 text-xs font-bold text-brand-text-muted uppercase tracking-wider pt-1">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span
                                        className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                                    <span
                                        className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-accent"></span>
                                </span>
                                {t('op_waiting_for_scanner')}
                            </div>
                        </form>
                    </div>
                </section>
            )}

            {/* 2. KARTA AKTYWNEJ PALETY (Wyświetlana po zeskanowaniu) */}
            {data.activePallet && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-300">

                    {/* LEWA STRONA: Dane techniczne i Cykle */}
                    <div
                        className="lg:col-span-2 bg-brand-surface border border-brand-border/80 rounded-2xl p-6 md:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">

                        {/* Nagłówek Karty */}
                        <div>
                            <div
                                className="flex justify-between items-start gap-4 pb-6 border-b border-brand-border/60">
                                <div>
                                    <span
                                        className="text-[11px] font-black text-brand-accent uppercase tracking-[0.2em] mb-1 block">
                                        {t('op_technical_data')}
                                    </span>
                                    <h3 className="text-4xl md:text-5xl font-black text-brand-text tracking-tight uppercase font-mono">
                                        {data.activePallet.pallet_id}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <PalletStatusSpan status={data.activePallet.status as PalletStatus}
                                        block_reason={data.activePallet.block_reason} />
                                    <button
                                        onClick={actions.handleClearActivePallet}
                                        className="p-2.5 bg-brand-bg border border-brand-border rounded-xl text-brand-text-muted hover:text-white hover:border-red-500/50 hover:bg-red-500/10 transition-all active:scale-95"
                                        title={t('btn_cancel')}
                                        aria-label={t('btn_cancel')}
                                    >
                                        <X size={22} />
                                    </button>
                                </div>
                            </div>

                            {/* Informacje o Projekcie i Modelu */}
                            <div className="grid grid-cols-2 gap-4 py-6 border-b border-brand-border/60">
                                <div
                                    className="bg-brand-bg/50 border border-brand-border/40 p-4 rounded-xl flex items-center gap-3">
                                    <div
                                        className="p-2.5 bg-brand-surface border border-brand-border/60 rounded-lg text-brand-accent">
                                        <Layers size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-extrabold text-brand-text-muted uppercase tracking-wider">{t('col_project')}</p>
                                        <p className="text-lg font-black text-brand-text truncate">{data.activePallet.project || '-'}</p>
                                    </div>
                                </div>

                                <div
                                    className="bg-brand-bg/50 border border-brand-border/40 p-4 rounded-xl flex items-center gap-3">
                                    <div
                                        className="p-2.5 bg-brand-surface border border-brand-border/60 rounded-lg text-brand-accent">
                                        <Box size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-extrabold text-brand-text-muted uppercase tracking-wider">{t('op_project_model')}</p>
                                        <p className="text-lg font-black text-brand-text truncate">{data.activePallet.model || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sekcja Cykli Pracy (Pasek zużycia) */}
                        <div className="pt-6 space-y-3">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs font-black text-brand-text-muted uppercase tracking-wider">
                                    {t('op_work_cycles')}
                                </span>
                                <div className="text-right">
                                    <span
                                        className="text-2xl font-black font-mono text-brand-text">{currentCycles}</span>
                                    <span
                                        className="text-sm font-semibold font-mono text-brand-text-muted"> / {maxCycles}</span>
                                    <span
                                        className="text-xs font-bold text-brand-text-muted ml-2">({cyclePercentage}%)</span>
                                </div>
                            </div>

                            {/* Pasek Postępu (Wzmocniony wizualnie) */}
                            <div
                                className="h-3 w-full bg-brand-bg rounded-full p-0.5 overflow-hidden border border-brand-border/80 shadow-inner">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressColor(cyclePercentage)}`}
                                    style={{ width: `${cyclePercentage}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* PRAWA STRONA: Szybkie Zgłaszanie Awarii */}
                    <div
                        className="bg-brand-surface border border-brand-border/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl space-y-4">
                        <div>
                            <h4 className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <AlertTriangle size={18} className="text-red-400 animate-pulse" />
                                {t('op_report_fault')}
                            </h4>

                            <div className="space-y-3">
                                {[
                                    {
                                        id: 'mechanical',
                                        label: t('op_mechanical_damage'),
                                        status: "Damaged",
                                        icon: <Edit3 size={18} />
                                    },
                                    {
                                        id: 'dirty',
                                        label: t('op_washing_required'),
                                        status: "Washing_Required",
                                        icon: <WashingMachine size={18} />
                                    },
                                    {
                                        id: 'pockets',
                                        label: t('op_pockets_error'),
                                        status: "Damaged",
                                        icon: <AlertTriangle size={18} />
                                    },
                                ].map((fault) => (
                                    <button
                                        key={fault.id}
                                        disabled={data.isSubmitting}
                                        onClick={() => actions.handleReportFault(fault.label, fault.status as PalletStatus)}
                                        className="w-full group flex items-center justify-between p-4 bg-brand-bg/70 hover:bg-red-500/10 border border-brand-border/80 hover:border-red-500/40 rounded-xl transition-all text-left disabled:opacity-50 active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="p-2 bg-brand-surface border border-brand-border/60 group-hover:border-red-500/30 rounded-lg text-brand-text-muted group-hover:text-red-400 transition-colors">
                                                {fault.icon}
                                            </span>
                                            <span
                                                className="text-xs font-bold text-brand-text group-hover:text-white transition-colors">{fault.label}</span>
                                        </div>
                                        <ChevronRight size={16}
                                            className="text-brand-text-muted group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Przycisk Inna Usterka */}
                        <button
                            disabled={data.isSubmitting}
                            onClick={() => actions.setIsOtherFaultOpen(true)}
                            className="w-full py-3.5 px-4 border-2 border-dashed border-brand-border/80 hover:border-brand-accent/80 bg-brand-bg/30 hover:bg-brand-accent/5 rounded-xl text-xs font-black text-brand-text-muted hover:text-brand-accent transition-all uppercase tracking-wider disabled:opacity-50 active:scale-[0.98]"
                        >
                            + {t('op_other_fault_type')}
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL: INNA USTERKA */}
            <ModalPresence>
            {data.isOtherFaultOpen && (
                <ModalTransition
                    onBackdropClick={() => actions.setIsOtherFaultOpen(false)}
                    backdropClassName="bg-black/80 backdrop-blur-sm"
                >
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl z-10">
                        <div
                            className="p-5 border-b border-brand-border/80 flex justify-between items-center bg-brand-bg/40">
                            <h3 className="font-black text-brand-text uppercase tracking-tight text-sm flex items-center gap-2">
                                <AlertTriangle size={18} className="text-red-400" />
                                {t('op_describe_fault')}
                            </h3>
                            <button onClick={() => actions.setIsOtherFaultOpen(false)}
                                title={t('btn_close')}
                                aria-label={t('btn_close')}
                                className="text-brand-text-muted hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea
                                autoFocus
                                className="w-full bg-brand-bg border border-brand-border/80 rounded-xl p-4 text-brand-text text-sm focus:ring-4 focus:ring-red-500/10 outline-none min-h-27.5 transition-all resize-none"
                                placeholder={t('op_fault_description_placeholder')}
                                value={data.customFaultText}
                                onChange={(e) => actions.setCustomFaultText(e.target.value)}
                            />
                            <ModalFormActions
                                onCancel={() => actions.setIsOtherFaultOpen(false)}
                                submitType="button"
                                onSubmit={() => actions.handleReportFault(data.customFaultText, "Blocked")}
                                submitLabel={t('op_report_damage')}
                                submittingLabel={t('saving')}
                                isSubmitting={data.isSubmitting}
                                submitDisabled={!data.customFaultText.trim()}
                                variant="danger"
                            />
                        </div>
                    </div>
                </ModalTransition>
            )}
            </ModalPresence>

            {createPortal(<div
                className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 transform ${data.isToastOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'
                    }`}
            >
                <div
                    className="bg-brand-text text-brand-bg px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-accent animate-ping"></div>
                    <span className="text-xs font-black uppercase tracking-wider">{data.toastMsg}</span>
                </div>
            </div>, document.body)}

            <GlobalErrorModal
                isOpen={data.errorModalState.isOpen}
                title={data.errorModalState.title}
                message={data.errorModalState.message}
                onClose={actions.hideGlobalError}
            />
        </div>
    );
};
