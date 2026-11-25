import {RequiredMark} from '../components/FormFields';
import {OperatorReports} from '../components/OperatorReports';
import React from 'react';
import {Link} from 'react-router';
import {PalletStatusSpan} from '../components/PalletStatusSpan';
import {remainingCycles, waitingTime, washingSoonRatio} from '../lib/maintenanceQueue';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Wrench,
    X
} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {Pallet} from '@backend/shared/types';
import {useMaintenancePanel} from '../hooks/useMaintenancePanel.ts';

import {SearchInput} from "../components/SearchInput.tsx";
import {useEscapeKey} from "../hooks/useEscapeKey.ts";
import {ModalFormActions} from "../components/ModalFormActions.tsx";
import {ModalPresence, ModalTransition} from '../components/ModalTransition.tsx';

interface MaintenancePanelViewProps {
    pallets: Pallet[];
    inventoryState: 'ready' | 'loading' | 'error';
}

export const MaintenancePanelView: React.FC<MaintenancePanelViewProps> = (props) => {
    const {data, actions} = useMaintenancePanel(props);
    const {t, language} = useTranslation();

    const tabs = [
        ['queue', t('maintenance_queue')], ['repairs', t('for_repair')],
        ['routine', t('maintenance_wash_due')], ['soon', t('maintenance_wash_soon')],
    ] as const;

    useEscapeKey(data.selectedPallet !== null, actions.closeServiceLog);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" id="maintenance-panel-container">
            <SearchInput/>

            <section className="rounded-xl border border-brand-border bg-brand-surface">
                <header className="space-y-2 border-b border-brand-border p-3 sm:p-4">
                    <div role="group" aria-label={t('maintenance_queue')} className="flex flex-wrap gap-2">
                        {tabs.map(([tab, label]) => <button key={tab} type="button"
                            aria-pressed={data.activeTab === tab} onClick={() => actions.setActiveTab(tab)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-border px-3 text-xs font-bold text-brand-text-muted hover:text-brand-text aria-pressed:border-brand-accent/50 aria-pressed:bg-brand-accent/10 aria-pressed:text-indigo-300">
                            {label}<span className="tabular-nums">{props.inventoryState === 'ready' ? data.queues[tab].length : '—'}</span>
                        </button>)}
                    </div>
                    <p className="text-xs text-brand-text-muted">{data.activeTab === 'soon'
                        ? t('maintenance_soon_hint', {percent: washingSoonRatio * 100})
                        : t('maintenance_oldest_first')}</p>
                </header>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3 p-3 sm:p-4">
                    {data.visiblePallets.map(pallet => {
                        const active = pallet.status === 'Active';
                        const waiting = waitingTime(pallet, data.now, language);
                        return <article key={pallet.pallet_id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-brand-border bg-brand-bg p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Link to={`/maintenance/pallets/${encodeURIComponent(pallet.pallet_id)}/history`} className="wrap-anywhere font-mono text-sm font-bold text-indigo-300 underline underline-offset-4">
                                    {pallet.pallet_id}
                                </Link>
                                {active ? <span className="text-xs font-bold text-yellow-400">{t('maintenance_remaining_cycles', {count: remainingCycles(pallet)})}</span>
                                    : <PalletStatusSpan status={pallet.status} block_reason={pallet.block_reason}/>}
                            </div>
                            <div className="space-y-1 text-sm">
                                <p className="wrap-anywhere font-semibold">{pallet.project} · {pallet.model}</p>
                                <p className="text-xs text-brand-text-muted">{pallet.machine} · FIS {pallet.fis} · {pallet.current_cycles} / {pallet.max_cycles}</p>
                                {!active && <p className="text-xs text-brand-text-muted">{waiting
                                    ? t('maintenance_waiting_time', {time: waiting}) : t('maintenance_waiting_unknown')}</p>}
                            </div>
                            {!active && <button type="button" onClick={() => actions.handleOpenServiceLog(pallet)}
                                className="mt-auto flex min-h-10 items-center justify-center rounded-lg border border-brand-border bg-brand-surface px-3 text-xs font-bold hover:border-brand-accent/50 hover:text-indigo-300">
                                {t('start_servicing')}
                            </button>}
                        </article>;
                    })}
                    {data.visiblePallets.length === 0 && <p role="status" className="col-span-full py-8 text-center text-sm text-brand-text-muted">
                        {t(props.inventoryState === 'loading' ? 'features_loading' : props.inventoryState === 'error' ? 'fetch_error_banner'
                            : data.searchTermFromURL.trim() ? 'no_pallets_found' : data.activeTab === 'soon' ? 'maintenance_soon_empty' : 'queue_empty')}
                    </p>}
                </div>
            </section>

            {/* SERVICE LOG MODAL */}
            <ModalPresence>
            {data.selectedPallet && (
                <ModalTransition
                    onBackdropClick={actions.closeServiceLog}
                    backdropClassName="bg-brand-bg/80 backdrop-blur-md"
                >
                    <div
                        className="relative bg-brand-surface border border-brand-border w-full max-w-xl max-h-[85dvh] rounded-2xl overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.5)]">
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
                                onClick={actions.closeServiceLog}
                                disabled={data.isSubmitting}
                                title={t('btn_close')}
                                aria-label={t('btn_close')}
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-8 pt-6"><OperatorReports key={data.selectedPallet.pallet_id} palletId={data.selectedPallet.pallet_id}/></div>
                        <form onSubmit={actions.handleServiceLogSubmit} className="p-8 space-y-6">
                            {data.modalError && (
                                <div
                                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 animate-in shake duration-300">
                                    <AlertCircle className="text-red-300 shrink-0 mt-0.5" size={18}/>
                                    <p className="text-xs font-bold text-red-400 leading-tight">{data.modalError}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label
                                    htmlFor="maintenance-service-comment" className="text-xs font-black text-brand-text-muted uppercase tracking-widest">{t('maint_comment')}<RequiredMark/></label>
                                <textarea
                                    rows={3}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                                    placeholder={t(data.selectedPallet.status === 'Washing_Required'
                                        ? 'maint_routine_comment_placeholder'
                                        : 'maint_repair_comment_placeholder')}
                                    id="maintenance-service-comment" required value={data.repairDescription} disabled={data.isSubmitting}
                                    onChange={(e) => actions.setRepairDescription(e.target.value)}
                                ></textarea>
                            </div>

                            <ModalFormActions
                                onCancel={actions.closeServiceLog}
                                isSubmitting={data.isSubmitting}
                                submitLabel={t('approve_service_and_return')}
                                submitIcon={<CheckCircle2 size={18} aria-hidden="true"/>}
                                additionalActionLabel={data.selectedPallet.status === 'Washing_Required'
                                    ? t('op_report_damage')
                                    : undefined}
                                onAdditionalAction={data.selectedPallet.status === 'Washing_Required'
                                    ? actions.handleReportDamage
                                    : undefined}
                                additionalActionIcon={data.selectedPallet.status === 'Washing_Required'
                                    ? <AlertTriangle size={18} aria-hidden="true"/>
                                    : undefined}
                            />
                        </form>
                    </div>
                </ModalTransition>
            )}
            </ModalPresence>
        </div>
    );
};
