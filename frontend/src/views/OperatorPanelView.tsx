import type {PalletStatus} from '@backend/shared/types';
import React from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Box, CheckCircle2, ChevronRight, Edit3, Layers, LockKeyhole, Scan, Volume1, Volume2, VolumeX, WashingMachine, Wifi, WifiOff, X } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { useOperatorPanel } from '../hooks/useOperatorPanel.ts';
import { PalletStatusSpan } from "../components/PalletStatusSpan.tsx";
import { GlobalErrorModal } from "../components/GlobalErrorModal.tsx";
import { useEscapeKey } from "../hooks/useEscapeKey.ts";
import { ModalFormActions } from "../components/ModalFormActions.tsx";
import { ModalPresence, ModalTransition } from '../components/ModalTransition.tsx';
import { RequiredMark, SelectField, TextareaField } from '../components/FormFields.tsx';

export const OperatorPanelView: React.FC = () => {
    const { data, actions } = useOperatorPanel();
    const { t } = useTranslation();
    const reportingWashing = data.pendingFault?.status === 'Washing_Required';

    const currentCycles = data.activePallet?.current_cycles ?? 0;
    const maxCycles = data.activePallet?.max_cycles || 1;
    const cyclePercentage = Math.min(100, Math.round((currentCycles / maxCycles) * 100));

    useEscapeKey(data.errorModalState.isOpen || data.isOtherFaultOpen || data.unavailablePallet !== null, () => {
        if (data.errorModalState.isOpen) {
            actions.hideGlobalError();
        } else if (data.unavailablePallet) {
            actions.handleClearActivePallet();
        } else if (data.isFaultConfirmOpen && !data.isSubmitting) {
            actions.cancelFaultConfirmation();
        } else if (!data.isSubmitting) {
            actions.closeFaultModal();
        }
    });

    const getProgressColor = (percent: number) => {
        if (percent >= 90) return 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
        if (percent >= 75) return 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
        return 'bg-brand-accent shadow-[0_0_12px_rgba(59,130,246,0.3)]';
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        actions.setScannedId(e.target.value);
    };

    return (
        <div className="w-full min-w-0 space-y-4 xl:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" id="operator-panel-container">
            {/* Pasek narzędziowy: Status sieci, regulacja głośności i przycisk włączania dźwięków */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-0.5">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-wider text-brand-text-muted">
                        {t('op_station_title')}
                    </span>

                    {/* Wskaźnik stanu sieci / łączności */}
                    <div
                        id="operator-network-status"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black border transition-all duration-300 ${
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
                            <span className="text-xs opacity-75 font-semibold">{t('op_volume_label')}:</span>
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
                                className={`operator-sound-ripple absolute inset-0 rounded-xl pointer-events-none border-2 ${
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
                                <span className="text-xs uppercase tracking-wider font-extrabold opacity-75">
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
            {data.scanFeedback && !data.unavailablePallet && (
                <div
                    role={data.scanFeedback.tone === 'error' ? 'alert' : 'status'}
                    className={`rounded-2xl border p-5 sm:p-6 text-lg sm:text-xl font-black flex items-center gap-3 shadow-lg transition-all animate-in fade-in duration-200 ${data.scanFeedback.tone === 'error'
                            ? 'border-red-500/60 bg-red-500/10 text-red-200 shadow-red-950/30'
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
            {!data.activePallet && !data.unavailablePallet && (
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

                    <div className="p-5 sm:p-6 xl:p-12 flex flex-col items-center text-center space-y-4 xl:space-y-6">
                        <div
                            className={`w-16 h-16 xl:w-24 xl:h-24 rounded-2xl flex items-center justify-center transition-all duration-300 border ${data.scanStatus === 'SUCCESS'
                                    ? 'bg-green-500/10 border-green-500/40 text-green-400 scale-105'
                                    : data.scanStatus === 'WARNING'
                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 scale-105'
                                        : data.scanStatus === 'ERROR'
                                            ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-in shake'
                                            : 'bg-brand-accent/10 border-brand-accent/20 text-brand-accent'
                                }`}
                        >
                            <Scan className="size-9 xl:size-12 animate-pulse" />
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-2xl xl:text-3xl font-black text-brand-text uppercase tracking-tight">{t('op_scanner_title')}</h2>
                            <p className="text-brand-text-muted text-xs xl:text-sm font-medium">{t('op_scanner_subtitle')}</p>
                        </div>

                        <form id={"scanner-form"} onSubmit={(e) => actions.handleScanSubmit(e)}
                            className="w-full max-w-md space-y-2.5 xl:space-y-3">
                            <label htmlFor="pallet-scanner-input" className="block text-left text-xs font-bold text-brand-text-muted">{t('op_scan_input_label')}<RequiredMark/></label>
                            <div className="relative">
                                <input
                                    id="pallet-scanner-input"
                                    ref={actions.barcodeInputRef}
                                    type="text"
                                    required
                                    value={data.scannedId || ''}
                                    onChange={handleInputChange}
                                    aria-label={t('op_scan_input_label')}
                                    aria-describedby="pallet-scanner-help pallet-scanner-status"
                                    className="w-full bg-brand-bg/80 border-2 border-brand-border rounded-xl py-3 xl:py-4 px-5 xl:px-6 text-xl xl:text-2xl font-mono font-black text-brand-accent focus:ring-4 focus:ring-brand-accent/10 outline-none transition-all text-center tracking-widest uppercase shadow-inner"
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
                                        ? t(data.unavailablePallet ? 'op_blocked_scan_status' : 'op_scan_retry')
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
            {data.unavailablePallet && <section aria-labelledby="blocked-pallet-title" className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-xl">
                <div className="h-1 bg-rose-400/80"/>
                <div className="space-y-6 p-6 sm:p-8">
                    <header className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300">{data.unavailablePallet.status === 'Blocked' ? <LockKeyhole size={24}/> : <AlertTriangle size={24}/>}</span>
                            <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">{t(data.unavailablePallet.status === 'Blocked' ? 'op_blocked_title' : 'op_damaged_title')}</p>
                                <h2 id="blocked-pallet-title" className="mt-1 break-all font-mono text-3xl font-black tracking-tight text-brand-text sm:text-4xl">{data.unavailablePallet.pallet_id}</h2>
                                <p className="mt-2 text-xs text-brand-text-muted">{data.unavailablePallet.project} · {data.unavailablePallet.model} · {data.unavailablePallet.machine}</p></div>
                        </div>
                        <button type="button" aria-label={t('op_scan_next')} onClick={actions.handleClearActivePallet} className="rounded-xl border border-brand-border bg-brand-bg p-2.5 text-brand-text-muted transition-colors hover:text-brand-text"><X size={20}/></button>
                    </header>
                    <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-5 py-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-300">{t(data.unavailablePallet.status === 'Blocked' ? 'block_reason' : 'reason_for_reporting')}</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-base font-semibold leading-relaxed text-brand-text">{data.unavailablePallet.block_reason || t(data.unavailablePallet.status === 'Blocked' ? 'block_reason_missing' : 'op_damage_reason_missing')}</p>
                    </div>
                    <div className="grid items-center gap-5 border-t border-brand-border pt-5 md:grid-cols-2">
                        <p className="max-w-md text-sm leading-relaxed text-brand-text-muted">{t(data.unavailablePallet.status === 'Blocked' ? 'op_blocked_help' : 'op_damaged_help')}</p>
                        <form id="scanner-form" onSubmit={e => actions.handleScanSubmit(e)} className="relative">
                            <label htmlFor="pallet-scanner-input" className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t('op_scan_next')}<RequiredMark/></label>
                            <div className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-bg px-4 focus-within:border-brand-accent">
                                <Scan size={19} className="shrink-0 text-brand-text-muted"/>
                                <input id="pallet-scanner-input" required ref={actions.barcodeInputRef} value={data.scannedId} onChange={handleInputChange} onFocus={e => e.target.select()} aria-label={t('op_scan_input_label')} autoComplete="off" disabled={data.isScanning} className="min-w-0 flex-1 bg-transparent py-3.5 font-mono text-sm font-bold uppercase tracking-wider text-brand-text outline-none"/>
                                <button type="submit" disabled={data.isScanning} aria-label={t('btn_scan')} className="rounded-lg p-2 text-brand-accent hover:bg-brand-accent/10"><ArrowRight size={18}/></button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>}
            {data.activePallet && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:gap-6 animate-in slide-in-from-bottom-4 duration-300">

                    {/* LEWA STRONA: Dane techniczne i Cykle */}
                    <div
                        className="lg:col-span-2 bg-brand-surface border border-brand-border/80 rounded-2xl p-5 xl:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">

                        {/* Nagłówek Karty */}
                        <div>
                            <div
                                className="flex flex-wrap justify-between items-start gap-3 pb-4 xl:pb-6 border-b border-brand-border/60">
                                <div>
                                    <span
                                        className="text-xs font-black text-brand-accent uppercase tracking-[0.2em] mb-1 block">
                                        {t('op_technical_data')}
                                    </span>
                                    <h3 className="text-3xl xl:text-5xl font-black text-brand-text tracking-tight uppercase font-mono">
                                        {data.activePallet.pallet_id}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <PalletStatusSpan emphasis status={data.activePallet.status as PalletStatus}
                                        block_reason={data.activePallet.block_reason} />
                                    <button
                                        onClick={actions.handleClearActivePallet}
                                        className="p-2.5 bg-brand-bg border border-brand-border rounded-xl text-brand-text-muted hover:text-brand-display hover:border-red-500/50 hover:bg-red-500/10 transition-all active:scale-95 flex items-center gap-1.5"
                                        title={`${t('btn_cancel')} [ESC]`}
                                        aria-label={`${t('btn_cancel')} [ESC]`}
                                    >
                                        <X size={20} />
                                        <span className="hidden sm:inline text-xs font-mono font-bold bg-brand-surface-high border border-brand-border px-1.5 py-0.5 rounded text-brand-text-muted">ESC</span>
                                    </button>
                                </div>
                            </div>

                            {/* Informacje o Projekcie i Modelu */}
                            <div className="grid grid-cols-2 gap-3 xl:gap-4 py-4 xl:py-6 border-b border-brand-border/60">
                                <div
                                    className="bg-brand-bg/50 border border-brand-border/40 p-3 xl:p-4 rounded-xl flex items-center gap-3">
                                    <div
                                        className="p-2 xl:p-2.5 bg-brand-surface border border-brand-border/60 rounded-lg text-brand-accent">
                                        <Layers size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-extrabold text-brand-text-muted uppercase tracking-wider">{t('col_project')}</p>
                                        <p className="text-base xl:text-lg font-black text-brand-text truncate">{data.activePallet.project || '-'}</p>
                                    </div>
                                </div>

                                <div
                                    className="bg-brand-bg/50 border border-brand-border/40 p-3 xl:p-4 rounded-xl flex items-center gap-3">
                                    <div
                                        className="p-2 xl:p-2.5 bg-brand-surface border border-brand-border/60 rounded-lg text-brand-accent">
                                        <Box size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-extrabold text-brand-text-muted uppercase tracking-wider">{t('op_project_model')}</p>
                                        <p className="text-base xl:text-lg font-black text-brand-text truncate">{data.activePallet.model || '-'} · {data.activePallet.machine}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sekcja Cykli Pracy (Pasek zużycia) */}
                        <div className="pt-4 xl:pt-6 space-y-2.5 xl:space-y-3">
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
                        className="bg-brand-surface border border-brand-border/80 rounded-2xl p-5 xl:p-6 flex flex-col justify-between shadow-xl space-y-3 xl:space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-3 xl:mb-4">
                                <h4 className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-red-400 animate-pulse" />
                                    {t('op_report_fault')}
                                </h4>
                                <span className="text-xs font-mono font-bold text-brand-text-muted bg-brand-surface-high border border-brand-border px-2 py-0.5 rounded">
                                    {t('op_hotkeys_hint')}
                                </span>
                            </div>

                            <div className="space-y-2.5 xl:space-y-3">
                                {[
                                    {name: t('op_mechanical_damage'), key: '1', icon: Edit3, status: 'Damaged' as const, defect: undefined},
                                    {name: t('op_washing_required'), key: '2', icon: WashingMachine, status: 'Washing_Required' as const, defect: undefined},
                                ].map(({name, key, icon: Icon, status, defect}) => <button key={key} type="button" disabled={data.isSubmitting} onClick={() => actions.openFaultModal(name, status, defect)} className="group flex w-full items-center justify-between gap-3 rounded-xl border border-brand-border/80 bg-brand-bg/70 p-3 xl:p-4 text-left transition-colors hover:border-red-400/40 hover:bg-red-400/5 disabled:opacity-50">
                                    <span className="flex min-w-0 items-center gap-3"><span className="rounded-lg border border-brand-border/60 bg-brand-surface p-2 text-brand-text-muted group-hover:text-red-300"><Icon size={18}/></span><span className="text-xs font-bold text-brand-text">{name}</span></span>
                                    <span className="flex shrink-0 items-center gap-2"><kbd className="rounded border border-brand-border bg-brand-surface px-1.5 py-0.5 font-mono text-xs font-bold text-brand-text-muted">[{key}]</kbd><ChevronRight size={16} className="text-brand-text-muted"/></span>
                                </button>)}
                            </div>
                        </div>
                        <button type="button" disabled={data.isSubmitting} onClick={() => actions.openFaultModal(t('op_other_fault_type'), 'Damaged', 'other')} className="min-h-11 xl:min-h-12 w-full rounded-xl border-2 border-dashed border-brand-border bg-brand-bg/30 px-4 py-2.5 xl:py-3 text-xs font-black uppercase tracking-wider text-brand-text-muted transition-colors hover:border-brand-accent/60 hover:text-brand-accent disabled:opacity-50">+ {t('op_other_fault_type')} [3]</button>
                    </div>
                </div>
            )}

            {/* MODAL KROK 1: WYBÓR I OPIS USTERKI */}
            <ModalPresence>
                {data.isOtherFaultOpen && !data.isFaultConfirmOpen && (
                    <ModalTransition
                        onBackdropClick={() => actions.closeFaultModal()}
                        className={reportingWashing ? undefined : 'items-start pt-6 sm:pt-10'}
                        backdropClassName="bg-black/80 backdrop-blur-sm"
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="operator-fault-title"
                            className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-2xl z-10">
                            <div
                                className="shrink-0 px-5 py-4 border-b border-brand-border/80 flex justify-between items-center bg-brand-bg/40">
                                <h3 id="operator-fault-title" className="font-black text-brand-text uppercase tracking-tight text-sm flex items-center gap-2">
                                    {reportingWashing ? <WashingMachine size={18} className="text-amber-400"/> : <AlertTriangle size={18} className="text-red-400"/>}
                                    {t(reportingWashing ? 'op_washing_required' : 'op_describe_fault')}
                                </h3>
                                <button onClick={() => actions.closeFaultModal()}
                                    disabled={data.isSubmitting}
                                    title={t('btn_close')}
                                    aria-label={t('btn_close')}
                                    className="text-brand-text-muted hover:text-brand-display transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                                {data.pendingFault?.status === 'Damaged' ? (
                                    <>
                                        <p className="text-sm font-bold text-brand-text">{data.pendingFault.name}</p>
                                        {data.defectsLoading && <p role="status" className="text-xs text-brand-text-muted">{t('features_loading')}</p>}
                                        {data.defectsError && <p role="alert" className="text-xs text-red-300">{t('defects_load_error')}</p>}
                                        <SelectField
                                            id="operator-defect-select"
                                            label={t('defect_label')}
                                            required
                                            value={data.selectedDefect}
                                            disabled={data.isSubmitting}
                                            onChange={event => actions.setSelectedDefect(event.target.value)}
                                        >
                                            <option value="">{t('defect_select')}</option>
                                            {data.defects.map(defect => (
                                                <option key={defect.id} value={String(defect.id)}>{defect.name}</option>
                                            ))}
                                            <option value="other">{t('op_other_fault_type')}</option>
                                        </SelectField>
                                    </>
                                ) : (
                                    <p className="text-sm leading-relaxed text-brand-text-muted">{t('op_washing_confirm_hint')}</p>
                                )}
                                {data.selectedDefect === 'other' && <TextareaField
                                    autoFocus
                                    label={t('op_describe_fault')}
                                    required
                                    maxLength={2000}
                                    disabled={data.isSubmitting}
                                    className="w-full bg-brand-bg border border-brand-border/80 rounded-xl p-3.5 text-brand-text text-sm focus:ring-4 focus:ring-red-500/10 outline-none min-h-22 transition-all resize-none"
                                    placeholder={t('op_fault_description_placeholder')}
                                    value={data.customFaultText}
                                    onChange={(e) => actions.setCustomFaultText(e.target.value)}
                                />}
                                <ModalFormActions
                                    onCancel={() => actions.closeFaultModal()}
                                    submitType="button"
                                    onSubmit={actions.requestFaultConfirmation}
                                    submitLabel={t(reportingWashing ? 'op_report_washing' : 'op_report_damage')}
                                    submittingLabel={t('saving')}
                                    isSubmitting={data.isSubmitting}
                                    submitDisabled={(data.pendingFault?.status === 'Damaged' && !data.selectedDefect) || (data.selectedDefect === 'other' && !data.customFaultText.trim())}
                                    variant={reportingWashing ? 'warning' : 'danger'}
                                />
                            </div>
                        </div>
                    </ModalTransition>
                )}
            </ModalPresence>

            {/* MODAL KROK 2: POTWIERDZENIE ZGŁOSZENIA (Przycisk potwierdzenia po lewej stronie, aby wykluczyć przypadkowy dwuklik na ekranie dotykowym) */}
            <ModalPresence>
                {data.isOtherFaultOpen && data.isFaultConfirmOpen && data.pendingFault && (
                    <ModalTransition
                        onBackdropClick={() => actions.cancelFaultConfirmation()}
                        backdropClassName="bg-black/85 backdrop-blur-sm"
                    >
                        <div
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="operator-fault-confirm-title"
                            aria-describedby="operator-fault-confirm-desc"
                            className={`relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 bg-brand-surface shadow-2xl ${reportingWashing ? 'border-amber-500/40' : 'border-red-500/40'}`}
                        >
                            <div className={`flex shrink-0 items-center justify-between border-b border-brand-border/80 px-5 py-4 ${reportingWashing ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                                <h3 id="operator-fault-confirm-title" className="font-black text-brand-text uppercase tracking-tight text-sm flex items-center gap-2">
                                    {reportingWashing ? <WashingMachine size={18} className="shrink-0 text-amber-400"/> : <AlertTriangle size={18} className="shrink-0 text-red-400"/>}
                                    {t('op_confirm_fault_title')}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => actions.cancelFaultConfirmation()}
                                    disabled={data.isSubmitting}
                                    title={t('btn_close')}
                                    aria-label={t('btn_close')}
                                    className="text-brand-text-muted hover:text-brand-display transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                                <p id="operator-fault-confirm-desc" className="text-xs font-medium text-brand-text-muted leading-relaxed">
                                    {t('op_confirm_fault_subtitle')}
                                </p>

                                {/* Podsumowanie wybranego problemu */}
                                <div className="rounded-xl border border-brand-border bg-brand-bg/80 p-4 space-y-3.5">
                                    {data.activePallet && (
                                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-brand-border/60">
                                            <div>
                                                <span className="text-xs font-extrabold uppercase tracking-wider text-brand-text-muted block">
                                                    {t('pallet_id_label')}
                                                </span>
                                                <span className="font-mono text-xl font-black text-brand-text">
                                                    {data.activePallet.pallet_id}
                                                </span>
                                                <span className="block text-xs text-brand-text-muted">
                                                    {data.activePallet.project} · {data.activePallet.model} · {data.activePallet.machine}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-extrabold uppercase tracking-wider text-brand-text-muted block mb-1">
                                                    {t('op_confirm_target_status')}
                                                </span>
                                                <PalletStatusSpan emphasis status={data.pendingFault.status}
                                                    block_reason={[data.selectedDefectLabel, data.customFaultText.trim()].filter(Boolean).join(' — ')}/>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <span className="text-xs font-extrabold uppercase tracking-wider text-red-300 block mb-1">
                                            {t('op_confirm_selected_fault')}
                                        </span>
                                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5">
                                            <p className="text-base font-black text-brand-display break-words">
                                                {data.selectedDefectLabel}
                                            </p>
                                            {data.customFaultText.trim() && (
                                                <p className="mt-1 text-xs font-medium text-red-200 whitespace-pre-wrap break-words">
                                                    {data.customFaultText.trim()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <ModalFormActions submitFirst submitType="button" variant={reportingWashing ? 'warning' : 'danger'}
                                    onSubmit={actions.handleReportFault} submitLabel={t('op_confirm_fault_submit')}
                                    submitIcon={<CheckCircle2 size={17}/>} isSubmitting={data.isSubmitting}
                                    onCancel={actions.cancelFaultConfirmation}
                                    cancelLabel={<><ArrowLeft size={16}/>{t('op_confirm_fault_back')}</>}/>
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
