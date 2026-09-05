import React from 'react';
import { AlertTriangle, Box, ChevronRight, Edit3, Layers, Scan, Volume1, Volume2, VolumeX, WashingMachine, Wifi, WifiOff, X } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { PalletStatus } from '@backend/shared/types';
import { useOperatorPanel } from '../hooks/useOperatorPanel.ts';
import { PalletStatusSpan } from "../components/PalletStatusSpan.tsx";
import { GlobalErrorModal } from "../components/GlobalErrorModal.tsx";
import { useEscapeKey } from "../hooks/useEscapeKey.ts";
import { ModalFormActions } from "../components/ModalFormActions.tsx";
import { ModalPresence, ModalTransition } from '../components/ModalTransition.tsx';
import { OPERATOR_OTHER_FAULT_STATUS } from '@backend/shared/permissions';

export const OperatorPanelView: React.FC = () => {
    const { data, actions } = useOperatorPanel();
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
        <div className="w-full min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" id="operator-panel-container">
            {/* Pasek narzędziowy: Status sieci, regulacja głośności i przycisk włączania dźwięków */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-wider text-brand-text-muted">
                        {t('op_station_title')}
                    </span>

                    {/* Wskaźnik stanu sieci / łączności */}
                    <div
                        id="operator-network-status"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6875rem] font-black border transition-all duration-300 ${
                            data.isOnline
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/15 border-rose-500/50 text-rose-300 animate-pulse'
                        }`}
                        title={data.isOnline ? t('op_network_online') : t('op_network_offline_alert')}
                    >
                        <span
                            className={`w-2 h-2 rounded-full ${
                                data.isOnline
                                    ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                                    : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                            }`}
                        />
                        {data.isOnline ? <Wifi size={13} /> : <WifiOff size={13} className="text-rose-400" />}
                        <span>{data.isOnline ? t('op_network_online') : t('op_network_offline')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Regulacja poziomu głośności (Cicho / Normalnie / Hala) */}
                    {data.soundEnabled && (
                        <button
                            id="operator-volume-cycle-btn"
                            type="button"
                            onClick={actions.cycleVolumeLevel}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text-muted hover:text-brand-text hover:border-brand-text-muted/60 transition-all text-xs font-bold active:scale-95 cursor-pointer shadow-sm"
                            title={t('op_volume_tooltip')}
                        >
                            <Volume1 size={16} className="text-brand-accent" />
                            <span className="text-[0.6875rem] opacity-75 font-semibold">{t('op_volume_label')}:</span>
                            <span className="font-mono font-black text-brand-text">
                                {data.volumeLevel === 'low'
                                    ? t('op_volume_low')
                                    : data.volumeLevel === 'loud'
                                    ? t('op_volume_loud')
                                    : t('op_volume_normal')}
                            </span>
                        </button>
                    )}

                    {/* Przycisk włączania / wyłączania dźwięków z wizualną falą dźwiękową (Soundwave Ripple) */}
                    <div className="relative">
                        {data.audioRipple && data.soundEnabled && (
                            <span
                                className={`absolute -inset-1.5 rounded-2xl pointer-events-none animate-ping opacity-60 border-2 ${
                                    data.audioRipple === 'error'
                                        ? 'border-rose-400'
                                        : data.audioRipple === 'warning'
                                        ? 'border-amber-400'
                                        : 'border-emerald-400'
                                }`}
                            />
                        )}
                        <button
                            id="operator-sound-toggle-btn"
                            type="button"
                            role="switch"
                            aria-checked={data.soundEnabled}
                            onClick={actions.toggleSound}
                            className={`group relative inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all duration-200 shadow-sm active:scale-95 cursor-pointer ${
                                data.soundEnabled
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                    : 'bg-brand-surface border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-text-muted/60'
                            }`}
                            title={data.soundEnabled ? t('op_sound_turn_off_tooltip') : t('op_sound_turn_on_tooltip')}
                        >
                            <span
                                className={`relative p-1.5 rounded-lg transition-colors ${
                                    data.soundEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-bg text-brand-text-muted group-hover:text-brand-text'
                                }`}
                            >
                                {data.audioRipple && data.soundEnabled && (
                                    <span
                                        className={`absolute inset-0 rounded-lg animate-ping opacity-75 ${
                                            data.audioRipple === 'error'
                                                ? 'bg-rose-400/40'
                                                : data.audioRipple === 'warning'
                                                ? 'bg-amber-400/40'
                                                : 'bg-emerald-400/40'
                                        }`}
                                    />
                                )}
                                {data.soundEnabled ? (
                                    <Volume2 size={18} className={data.audioRipple ? 'scale-125 transition-transform duration-150' : 'animate-pulse'} />
                                ) : (
                                    <VolumeX size={18} />
                                )}
                            </span>
                            <span className="flex flex-col text-left">
                                <span className="text-[0.6875rem] uppercase tracking-wider font-extrabold opacity-75">
                                    {t('op_scanner_sound')}
                                </span>
                                <span className="text-xs font-black flex items-center gap-1.5">
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full ${
                                            data.soundEnabled ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-zinc-500'
                                        }`}
                                    />
                                    {data.soundEnabled ? t('op_sound_enabled') : t('op_sound_disabled')}
                                </span>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
            {data.scanFeedback && (
                <div
                    role={data.scanFeedback.tone === 'error' ? 'alert' : 'status'}
                    className={`rounded-2xl border p-5 sm:p-6 text-lg sm:text-xl font-black flex items-center gap-3 shadow-lg transition-all animate-in fade-in duration-200 ${data.scanFeedback.tone === 'error'
                            ? 'border-rose-400/50 bg-rose-400/10 text-rose-200 shadow-rose-950/30'
                            : data.scanFeedback.tone === 'warning'
                                ? 'border-amber-400/50 bg-amber-400/10 text-amber-200 shadow-amber-950/30'
                                : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200 shadow-emerald-950/30'
                        }`}
                >
                    {data.scanFeedback.tone === 'error' && <span className="text-2xl font-bold">✕</span>}
                    {data.scanFeedback.tone === 'warning' && <AlertTriangle size={24} className="text-amber-400 shrink-0" />}
                    {data.scanFeedback.tone === 'success' && <span className="text-2xl font-bold">✓</span>}
                    <span>{data.scanFeedback.message}</span>
                </div>
            )}
            {/* 1. SEKCJA SKANERA (Gdy brak aktywnej palety) */}
            {!data.activePallet && (
                <section
                    className="bg-brand-surface border border-brand-border/80 rounded-2xl overflow-hidden shadow-2xl relative">
                    <div
                        className={`h-1.5 transition-colors duration-500 ${data.scanStatus === 'SUCCESS'
                                ? 'bg-green-500 shadow-[0_0_10px_#22c55e]'
                                : data.scanStatus === 'WARNING'
                                    ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'
                                    : data.scanStatus === 'ERROR'
                                        ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                                        : 'bg-brand-accent/40'
                            }`}
                    ></div>

                    <div className="p-8 md:p-14 flex flex-col items-center text-center space-y-6">
                        <div
                            className={`w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300 border ${data.scanStatus === 'SUCCESS'
                                    ? 'bg-green-500/10 border-green-500/40 text-green-400 scale-105'
                                    : data.scanStatus === 'WARNING'
                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 scale-105'
                                        : data.scanStatus === 'ERROR'
                                            ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-in shake'
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
                                    id="pallet-scanner-input"
                                    ref={actions.barcodeInputRef}
                                    type="text"
                                    value={data.scannedId || ''}
                                    onChange={handleInputChange}
                                    aria-label={t('op_scan_input_label')}
                                    aria-describedby="pallet-scanner-help pallet-scanner-status"
                                    className="w-full bg-brand-bg/80 border-2 border-brand-border rounded-xl py-4 px-6 text-2xl font-mono font-black text-brand-accent focus:ring-4 focus:ring-brand-accent/10 outline-none transition-all text-center tracking-widest uppercase shadow-inner"
                                    placeholder={t('op_scan_placeholder')}
                                    autoComplete="off"
                                    disabled={data.isScanning || data.isSubmitting}
                                />
                            </div>
                            <button type="submit" className="hidden" disabled={data.isScanning || data.isSubmitting}>{t('btn_scan')}</button>

                            <div
                                id="pallet-scanner-status"
                                role="status"
                                aria-live="polite"
                                className={`flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider pt-1 ${data.scanStatus === 'ERROR' ? 'text-red-400' : 'text-brand-text-muted'}`}>
                                {data.isScanning
                                    ? t('op_scanning')
                                    : data.scanStatus === 'ERROR'
                                        ? t('op_scan_retry')
                                        : t('op_waiting_for_scanner')}
                            </div>
                            <p id="pallet-scanner-help" className="text-xs leading-relaxed text-brand-text-muted">
                                {t('op_scan_help')}
                            </p>
                            {data.lastScannedId && (
                                <p className="text-xs text-brand-text-muted">
                                    {t('op_last_scanned')}: <span className="font-mono font-bold text-brand-accent">{data.lastScannedId}</span>
                                </p>
                            )}
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
                                        className="text-[0.6875rem] font-black text-brand-accent uppercase tracking-[0.2em] mb-1 block">
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
                                        className="p-2.5 bg-brand-bg border border-brand-border rounded-xl text-brand-text-muted hover:text-white hover:border-red-500/50 hover:bg-red-500/10 transition-all active:scale-95 flex items-center gap-1.5"
                                        title={`${t('btn_cancel')} [ESC]`}
                                        aria-label={`${t('btn_cancel')} [ESC]`}
                                    >
                                        <X size={20} />
                                        <span className="hidden sm:inline text-[0.625rem] font-mono font-bold bg-brand-surface-high border border-brand-border px-1.5 py-0.5 rounded text-brand-text-muted">ESC</span>
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
                                        <p className="text-[0.625rem] font-extrabold text-brand-text-muted uppercase tracking-wider">{t('col_project')}</p>
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
                                        <p className="text-[0.625rem] font-extrabold text-brand-text-muted uppercase tracking-wider">{t('op_project_model')}</p>
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
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-red-400 animate-pulse" />
                                    {t('op_report_fault')}
                                </h4>
                                <span className="text-[0.625rem] font-mono font-bold text-brand-text-muted bg-brand-surface-high border border-brand-border px-2 py-0.5 rounded">
                                    {t('op_hotkeys_hint')}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {[
                                    {
                                        id: 'mechanical',
                                        keyNum: '1',
                                        label: t('op_mechanical_damage'),
                                        status: "Damaged",
                                        icon: <Edit3 size={18} />
                                    },
                                    {
                                        id: 'dirty',
                                        keyNum: '2',
                                        label: t('op_washing_required'),
                                        status: "Washing_Required",
                                        icon: <WashingMachine size={18} />
                                    },
                                    {
                                        id: 'pockets',
                                        keyNum: '3',
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
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-brand-surface border border-brand-border text-brand-text-muted group-hover:border-red-500/40 group-hover:text-red-400">
                                                [{fault.keyNum}]
                                            </span>
                                            <ChevronRight size={16}
                                                className="text-brand-text-muted group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                                        </div>
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
                                    onSubmit={() => actions.handleReportFault(data.customFaultText, OPERATOR_OTHER_FAULT_STATUS)}
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



            <GlobalErrorModal
                isOpen={data.errorModalState.isOpen}
                title={data.errorModalState.title}
                message={data.errorModalState.message}
                onClose={actions.hideGlobalError}
            />
        </div>
    );
};
