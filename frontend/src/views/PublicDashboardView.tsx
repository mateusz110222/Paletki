import {DisplayModeControl} from '../components/DisplayModeControl';
import React, {useEffect, useMemo, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Clock3,
    Droplets,
    Gauge,
    LogIn,
    Package,
    RefreshCw,
    ScanLine,
    ShieldCheck,
    TimerReset,
    TriangleAlert,
    Wrench,
} from 'lucide-react';
import type {PalletStatus, PublicDashboardPallet} from '@backend/shared/types';
import {LanguageSwitcher, useTranslation} from '../i18n/LanguageContext.tsx';
import {useDocumentMetadata} from '../hooks/useDocumentMetadata.ts';
import {usePublicDashboard} from '../hooks/usePublicDashboard.ts';
import {StationSelectionView} from '../components/StationSelectionView.tsx';

const statusStyle: Record<PalletStatus, {dot: string; badge: string; icon: React.ReactNode}> = {
    Active: {
        dot: 'bg-emerald-400',
        badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
        icon: <CheckCircle2 size="0.8125rem"/>,
    },
    Washing_Required: {
        dot: 'bg-cyan-400',
        badge: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
        icon: <Droplets size="0.8125rem"/>,
    },
    Damaged: {
        dot: 'bg-rose-400',
        badge: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
        icon: <Wrench size="0.8125rem"/>,
    },
    Blocked: {
        dot: 'bg-orange-400',
        badge: 'border-orange-400/25 bg-orange-400/10 text-orange-300',
        icon: <TriangleAlert size="0.8125rem"/>,
    },
};

const formatDuration = (minutes: number, language: 'pl' | 'en') => {
    if (minutes < 1) return '—';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    if (hours < 24) return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} ${language === 'pl' ? 'd' : 'd'}${remainingHours ? ` ${remainingHours} h` : ''}`;
};

const parseTimestamp = (value: string | undefined) => {
    const timestamp = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
};

const elapsedMinutes = (timestamp: string, now: number) => {
    const startedAt = parseTimestamp(timestamp);
    return startedAt > 0 && now >= startedAt ? (now - startedAt) / 60_000 : 0;
};

const formatTimestamp = (
    value: string | number | undefined,
    locale: string,
    options: Intl.DateTimeFormatOptions,
) => {
    const timestamp = typeof value === 'number' ? value : parseTimestamp(value);
    return timestamp > 0 ? new Intl.DateTimeFormat(locale, options).format(new Date(timestamp)) : '—';
};

interface DashboardStatusLabels {
    active: string;
    washing: string;
    damaged: string;
    blocked: string;
}

const statusLabel = (status: PalletStatus, labels: DashboardStatusLabels) => ({
    Active: labels.active,
    Washing_Required: labels.washing,
    Damaged: labels.damaged,
    Blocked: labels.blocked,
})[status];

const KpiCard: React.FC<{
    label: string;
    value: React.ReactNode;
    detail: string;
    icon: React.ReactNode;
    tone: string;
}> = ({label, value, detail, icon, tone}) => (
    <div className="dashboard-panel group relative overflow-hidden rounded-2xl p-5">
        <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${tone} to-transparent opacity-80`}/>
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
                <p className="mt-1 text-[0.6875rem] font-medium text-slate-400">{detail}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-2.5 text-slate-300 transition-transform group-hover:-translate-y-0.5">
                {icon}
            </div>
        </div>
    </div>
);

const PanelHeader: React.FC<{icon: React.ReactNode; title: string; subtitle: string; aside?: React.ReactNode}> = ({
    icon,
    title,
    subtitle,
    aside,
}) => (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-indigo-400/20 bg-indigo-400/10 p-2 text-indigo-300">{icon}</div>
            <div className="min-w-0">
                <h2 className="text-sm font-extrabold tracking-tight text-white">{title}</h2>
                <p className="mt-1 text-[0.6875rem] text-slate-400">{subtitle}</p>
            </div>
        </div>
        {aside}
    </div>
);

const StationMetric: React.FC<{
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    tone: string;
}> = ({label, value, icon, tone}) => (
    <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
        <div className={`mb-4 flex size-9 items-center justify-center rounded-lg border ${tone}`}>{icon}</div>
        <p className="text-3xl font-black tracking-tight text-white">{value}</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
    </div>
);

export const PublicDashboardView: React.FC = () => {
    const {language, t} = useTranslation();
    const labels = {
        title: t('dashboard_title'),
        subtitle: t('dashboard_subtitle'),
        publicMode: t('dashboard_public_mode'),
        staffPanel: t('dashboard_staff_panel'),
        updated: t('dashboard_updated'),
        refreshing: t('dashboard_refreshing'),
        availability: t('dashboard_availability'),
        operational: t('dashboard_operational'),
        washSoon: t('dashboard_wash_soon'),
        inWash: t('dashboard_in_wash'),
        avgService: t('dashboard_avg_service'),
        last30Days: t('dashboard_last_30_days'),
        upcomingTitle: t('dashboard_upcoming_title'),
        upcomingSubtitle: t('dashboard_upcoming_subtitle'),
        pallet: t('dashboard_pallet'),
        project: t('dashboard_project_model'),
        cycles: t('dashboard_cycles'),
        remaining: t('dashboard_remaining'),
        state: t('dashboard_state'),
        dueNow: t('dashboard_due_now'),
        cyclesLeft: t('dashboard_cycles_left'),
        noUpcoming: t('dashboard_no_upcoming'),
        serviceTrend: t('dashboard_service_trend'),
        serviceTrendSubtitle: t('dashboard_service_trend_subtitle'),
        average: t('dashboard_average'),
        completed: t('dashboard_completed'),
        noServiceHistory: t('dashboard_no_service_history'),
        queue: t('dashboard_queue'),
        queueSubtitle: t('dashboard_queue_subtitle'),
        waiting: t('dashboard_waiting'),
        queueEmpty: t('dashboard_queue_empty'),
        projectLoad: t('dashboard_project_load'),
        projectLoadSubtitle: t('dashboard_project_load_subtitle'),
        allPallets: t('dashboard_all_pallets'),
        errorTitle: t('dashboard_error_title'),
        errorHint: t('dashboard_error_hint'),
        retry: t('dashboard_retry'),
        loading: t('dashboard_loading'),
        active: t('dashboard_status_active'),
        washing: t('dashboard_status_washing'),
        damaged: t('dashboard_status_damaged'),
        blocked: t('dashboard_status_blocked'),
        justNow: t('dashboard_just_now'),
        station: t('dashboard_station'),
        changeStation: t('dashboard_change_station'),
        allLines: t('dashboard_all_lines'),
        lineStatus: t('dashboard_line_status'),
        lineProject: t('dashboard_line_project'),
        linePallets: t('dashboard_line_pallets'),
        linePalletsHint: t('dashboard_line_pallets_hint'),
        lineClear: t('dashboard_line_clear'),
        lineClearHint: t('dashboard_line_clear_hint'),
        cycleUsage: t('dashboard_cycle_usage'),
        lastScannedPallet: t('dashboard_last_scanned_pallet'),
        lastScannedAt: t('dashboard_last_scanned_at'),
        noScanData: t('dashboard_no_scan_data'),
    };
    const [searchParams, setSearchParams] = useSearchParams();
    const stationFromUrl = searchParams.get('station')?.trim() || undefined;
    const {query, metrics, cycleProgress} = usePublicDashboard(stationFromUrl);
    const showAll = query.data?.scope === 'all';
    const selectedStation = query.data?.selected_station;
    const [now, setNow] = useState(0);

    useDocumentMetadata(`PalletX | ${labels.title}`, labels.subtitle, language);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    const statusCounts = useMemo(() => {
        const counts: Record<PalletStatus, number> = {Active: 0, Washing_Required: 0, Damaged: 0, Blocked: 0};
        for (const pallet of query.data?.pallets ?? []) {
            if (!selectedStation || pallet.project === selectedStation.project) counts[pallet.status] += 1;
        }
        return counts;
    }, [query.data, selectedStation]);

    if (query.isPending) {
        return (
            <div className="dashboard-public min-h-screen grid place-items-center p-6 text-white">
                <div className="text-center">
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-indigo-400/25 bg-indigo-400/10">
                        <RefreshCw className="animate-spin text-indigo-300" size="1.5rem"/>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-300">{labels.loading}</p>
                </div>
            </div>
        );
    }

    if (query.isError) {
        return (
            <div className="dashboard-public min-h-screen grid place-items-center p-6 text-white">
                <div className="dashboard-panel max-w-md rounded-2xl p-8 text-center">
                    <AlertTriangle className="mx-auto text-amber-300" size="2.125rem"/>
                    <h1 className="mt-4 text-lg font-black">{labels.errorTitle}</h1>
                    <p className="mt-2 text-sm text-slate-400">{labels.errorHint}</p>
                    <button onClick={() => query.refetch()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-400">
                        <RefreshCw size="0.875rem"/> {labels.retry}
                    </button>
                </div>
            </div>
        );
    }

    if (!showAll && (!stationFromUrl || !selectedStation)) {
        return (
            <StationSelectionView
                stations={query.data?.stations ?? []}
                invalidSelection={Boolean(stationFromUrl)}
                onSelect={(station) => setSearchParams({station})}
                onSelectAll={() => setSearchParams({station: 'ALL'})}
            />
        );
    }

    const locale = language === 'pl' ? 'pl-PL' : 'en-GB';
    const service = query.data?.service ?? {daily: [], average_minutes_30d: 0, completed_30d: 0};
    const chart = service.daily;
    const maxChartValue = Math.max(1, ...chart.map((point) => point.average_minutes));
    const completedInChart = chart.reduce((sum, point) => sum + point.completed, 0);
    const generatedAt = parseTimestamp(query.data?.generated_at);
    const effectiveNow = now || generatedAt;
    const lastUpdated = formatTimestamp(query.data?.generated_at, locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const clock = formatTimestamp(effectiveNow, locale, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
    const stationPallet = selectedStation
        ? query.data?.pallets.find((pallet) => pallet.pallet_id === selectedStation.pallet_id)
        : undefined;
    const stationProgress = stationPallet ? cycleProgress(stationPallet) : 0;
    const stationCyclesRemaining = stationPallet
        ? Math.max(0, stationPallet.max_cycles - stationPallet.current_cycles)
        : 0;
    const stationHasAttention = metrics.serviceQueue.length > 0 || metrics.dueSoon.length > 0;
    const stationPallets = (query.data?.pallets ?? []).filter((pallet) => pallet.project === selectedStation?.project);

    return (
        <div className="dashboard-screen dashboard-public min-h-screen text-slate-100 selection:bg-indigo-400 selection:text-slate-950">
            <DisplayModeControl/>
            <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-brand-bg/90 backdrop-blur-xl">
                <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7 lg:px-10">
                    <div className="flex items-center gap-4">
                        <div className="relative grid size-11 place-items-center rounded-xl border border-indigo-400/30 bg-indigo-400/10 text-indigo-300 shadow-[0_0_30px_rgba(99,102,241,0.14)]">
                            <Package size="1.375rem"/>
                            <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-brand-bg bg-emerald-400"/>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black tracking-[0.16em] text-white">PALLETX</span>
                                <span className="rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[0.5rem] font-black tracking-[0.15em] text-emerald-300">LIVE</span>
                            </div>
                            <h1 className="mt-0.5 text-xs font-semibold text-slate-300 sm:text-sm">{labels.title}</h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                        <div className="hidden rounded-lg border border-indigo-400/20 bg-indigo-400/8 px-3 py-2 text-right sm:block">
                            <p className="text-[0.5625rem] font-bold uppercase tracking-wider text-indigo-300">
                                {showAll ? 'ALL' : `${labels.station}: ${selectedStation?.station}`}
                            </p>
                            <p className="mt-0.5 max-w-48 truncate text-[0.625rem] font-semibold text-white">
                                {showAll ? labels.allLines : selectedStation?.project}
                            </p>
                        </div>
                        <button type="button" onClick={() => setSearchParams({})} className="min-h-10 rounded-lg border border-white/10 bg-white/4 px-3 text-[0.625rem] font-bold text-slate-200 hover:bg-white/8">
                            {labels.changeStation}
                        </button>
                        <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/2.5 px-3 py-2 text-[0.625rem] text-slate-400 lg:flex">
                            <ShieldCheck size="0.8125rem" className="text-emerald-400"/> {labels.publicMode}
                        </div>
                        <div className="rounded-lg border border-white/[0.07] bg-white/2.5 px-3 py-2 text-right">
                            <p className="text-[0.625rem] font-bold text-slate-200">{clock}</p>
                            <p className="mt-0.5 flex items-center justify-end gap-1 text-[0.5625rem] text-slate-500">
                                <span className={`size-1.5 rounded-full ${query.isFetching ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`}/>
                                {query.isFetching ? labels.refreshing : `${labels.updated}: ${lastUpdated}`}
                            </p>
                        </div>
                        <LanguageSwitcher/>
                        <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 text-[0.625rem] font-bold text-slate-200 hover:border-indigo-400/35 hover:bg-indigo-400/10 hover:text-white">
                            <LogIn size="0.875rem"/><span className="hidden sm:inline">{labels.staffPanel}</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full space-y-5 px-5 py-6 sm:px-7 lg:px-10 lg:py-8">
                {!showAll && selectedStation ? (
                    <>
                        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(380px,0.75fr)]">
                            <div className="dashboard-panel relative overflow-hidden rounded-2xl p-6 sm:p-8">
                                <div className="pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-indigo-500/[0.08] blur-3xl"/>
                                <div className="relative">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{labels.lineProject}</p>
                                            <h2 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">{selectedStation.project}</h2>
                                            <p className="mt-2 text-sm font-semibold text-slate-400">{labels.station}: <span className="text-slate-200">{selectedStation.station}</span></p>
                                        </div>
                                        {stationPallet && <StatusBadge pallet={stationPallet} labels={labels}/>}
                                    </div>

                                    <div className="mt-7 rounded-2xl border border-indigo-400/20 bg-indigo-400/[0.07] p-5 sm:p-6">
                                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-300">
                                            <ScanLine size="1.125rem"/>{labels.lastScannedPallet}
                                        </div>
                                        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
                                            <div>
                                                <p className="font-mono text-4xl font-black tracking-tight text-white sm:text-6xl">
                                                    {selectedStation.pallet_id || labels.noScanData}
                                                </p>
                                                <p className="mt-2 text-base font-bold text-slate-300 sm:text-lg">{selectedStation.model}</p>
                                            </div>
                                            <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-right">
                                                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-slate-500">{labels.lastScannedAt}</p>
                                                <p className="mt-1 text-base font-black text-white">
                                                    {formatTimestamp(selectedStation.updated_at, locale, {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'})}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {stationPallet && (
                                        <div className="mt-6">
                                            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{labels.cycleUsage}</p>
                                                    <p className="mt-1 font-mono text-lg font-black text-white">{stationPallet.current_cycles} / {stationPallet.max_cycles}</p>
                                                </div>
                                                <p className="text-sm font-bold text-slate-300"><span className="text-emerald-300">{stationCyclesRemaining}</span> {labels.cyclesLeft}</p>
                                            </div>
                                            <div className="h-3 overflow-hidden rounded-full bg-white/[0.07]">
                                                <div
                                                    className={`h-full rounded-full transition-[width] duration-700 ${stationProgress >= 95 ? 'bg-rose-400' : stationProgress >= 80 ? 'bg-amber-300' : 'bg-emerald-400'}`}
                                                    style={{width: `${stationProgress}%`}}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="dashboard-panel rounded-2xl p-5 sm:p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{labels.lineStatus}</p>
                                        <p className="mt-2 text-5xl font-black tracking-tight text-emerald-300">{metrics.availability}%</p>
                                    </div>
                                    <div className="grid size-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                                        <Gauge size="1.6875rem"/>
                                    </div>
                                </div>
                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    <StationMetric label={labels.operational} value={metrics.operational} icon={<Activity size="1.125rem"/>} tone="border-emerald-400/20 bg-emerald-400/10 text-emerald-300"/>
                                    <StationMetric label={labels.washSoon} value={metrics.dueSoon.length} icon={<TimerReset size="1.125rem"/>} tone="border-amber-300/20 bg-amber-300/10 text-amber-200"/>
                                    <StationMetric label={labels.inWash} value={statusCounts.Washing_Required} icon={<Droplets size="1.125rem"/>} tone="border-cyan-300/20 bg-cyan-300/10 text-cyan-200"/>
                                    <StationMetric label={labels.damaged} value={statusCounts.Damaged + statusCounts.Blocked} icon={<Wrench size="1.125rem"/>} tone="border-rose-400/20 bg-rose-400/10 text-rose-300"/>
                                </div>
                            </div>
                        </section>

                        {!stationHasAttention && (
                            <section className="flex flex-col gap-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div className="flex items-center gap-4">
                                    <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                                        <CheckCircle2 size="1.4375rem"/>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-white">{labels.lineClear}</h2>
                                        <p className="mt-0.5 text-sm text-slate-400">{labels.lineClearHint}</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-2 self-start rounded-lg border border-emerald-400/15 bg-black/15 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-300 sm:self-auto">
                                    <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]"/>
                                    LIVE
                                </span>
                            </section>
                        )}

                        <section className="dashboard-panel overflow-hidden rounded-2xl">
                            <PanelHeader icon={<Package size="1.0625rem"/>} title={labels.linePallets} subtitle={labels.linePalletsHint} aside={
                                <span className="rounded-lg border border-indigo-300/15 bg-indigo-300/[0.07] px-2.5 py-1 text-xs font-black text-indigo-200">{metrics.total}</span>
                            }/>
                            <div className={`grid gap-px bg-white/[0.055] ${stationPallets.length > 1 ? 'station-pallet-grid' : 'grid-cols-1'}`}>
                                {stationPallets.map((pallet) => {
                                    const progress = cycleProgress(pallet);
                                    return (
                                        <div key={pallet.pallet_id} className={`bg-[#101622] p-5 ${stationPallets.length === 1 ? 'sm:flex sm:items-center sm:gap-8' : ''}`}>
                                            <div className={`flex items-start justify-between gap-4 ${stationPallets.length === 1 ? 'sm:min-w-80' : ''}`}>
                                                <div className="min-w-0">
                                                    <p className="truncate font-mono text-xl font-black text-white">{pallet.pallet_id}</p>
                                                    <p className="mt-1 truncate text-sm font-semibold text-slate-400">{pallet.model}</p>
                                                </div>
                                                <StatusBadge pallet={pallet} labels={labels}/>
                                            </div>
                                            <div className={`mt-5 flex items-center gap-3 ${stationPallets.length === 1 ? 'sm:mt-0 sm:flex-1' : ''}`}>
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                                                    <div className={`h-full rounded-full ${progress >= 95 ? 'bg-rose-400' : progress >= 80 ? 'bg-amber-300' : 'bg-emerald-400'}`} style={{width: `${progress}%`}}/>
                                                </div>
                                                <span className="font-mono text-sm font-black text-slate-200">{pallet.current_cycles}/{pallet.max_cycles}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                ) : (
                    <>
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
                    <KpiCard label={labels.availability} value={`${metrics.availability}%`} detail={`${metrics.operational} / ${metrics.total}`} icon={<Gauge size="1.25rem"/>} tone="via-emerald-400/70"/>
                    <KpiCard label={labels.operational} value={metrics.operational} detail={`${metrics.total} ${labels.allPallets}`} icon={<Activity size="1.25rem"/>} tone="via-indigo-400/70"/>
                    <KpiCard label={labels.washSoon} value={metrics.dueSoon.length} detail="≥ 80%" icon={<TimerReset size="1.25rem"/>} tone="via-amber-300/70"/>
                    <KpiCard label={labels.inWash} value={metrics.awaitingWash.length} detail={`${statusCounts.Damaged} ${labels.damaged.toLowerCase()}`} icon={<Droplets size="1.25rem"/>} tone="via-cyan-300/70"/>
                    <div className="col-span-2 lg:col-span-1">
                        <KpiCard label={labels.avgService} value={formatDuration(service.average_minutes_30d, language)} detail={`${service.completed_30d} · ${labels.last30Days}`} icon={<Clock3 size="1.25rem"/>} tone="via-fuchsia-400/70"/>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.85fr)]">
                    <div className="dashboard-panel overflow-hidden rounded-2xl">
                        <PanelHeader icon={<Droplets size="1.0625rem"/>} title={labels.upcomingTitle} subtitle={labels.upcomingSubtitle} aside={
                            <span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[0.625rem] font-black text-amber-200">{metrics.upcoming.length}</span>
                        }/>
                        <div className="overflow-x-auto">
                            {metrics.upcoming.length > 0 ? (
                                <table className="w-full min-w-170 border-collapse text-left">
                                    <thead>
                                    <tr className="border-b border-white/5.5 text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                                        <th className="px-6 py-3">{labels.pallet}</th>
                                        <th className="px-4 py-3">{labels.project}</th>
                                        <th className="px-4 py-3">{labels.cycles}</th>
                                        <th className="px-4 py-3">{labels.remaining}</th>
                                        <th className="px-6 py-3 text-right">{labels.state}</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {metrics.upcoming.map((pallet) => {
                                        const progress = cycleProgress(pallet);
                                        const due = pallet.status === 'Washing_Required';
                                        return (
                                            <tr key={pallet.pallet_id} className="border-b border-white/4.5 last:border-0 hover:bg-white/2.5">
                                                <td className="px-6 py-3.5"><span className="font-mono text-xs font-bold text-white">{pallet.pallet_id}</span></td>
                                                <td className="px-4 py-3.5">
                                                    <p className="max-w-52 truncate text-xs font-semibold text-slate-200">{pallet.project}</p>
                                                    <p className="mt-0.5 max-w-52 truncate text-[0.625rem] text-slate-500">{pallet.model}</p>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.07]">
                                                            <div className={`h-full rounded-full ${due ? 'bg-cyan-400' : progress >= 95 ? 'bg-rose-400' : 'bg-amber-300'}`} style={{width: `${progress}%`}}/>
                                                        </div>
                                                        <span className="w-9 font-mono text-[0.625rem] font-bold text-slate-300">{progress}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 font-mono text-[0.625rem] font-semibold text-slate-300">
                                                    {due ? labels.dueNow : `${Math.max(0, pallet.max_cycles - pallet.current_cycles)} ${labels.cyclesLeft}`}
                                                </td>
                                                <td className="px-6 py-3.5 text-right"><StatusBadge pallet={pallet} labels={labels}/></td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            ) : (
                                <EmptyState icon={<CheckCircle2 size="1.5rem"/>} text={labels.noUpcoming}/>
                            )}
                        </div>
                    </div>

                    <div className="dashboard-panel overflow-hidden rounded-2xl">
                        <PanelHeader icon={<BarChart3 size="1.0625rem"/>} title={labels.serviceTrend} subtitle={labels.serviceTrendSubtitle}/>
                        <div className="p-5 sm:p-6">
                            <div className="mb-5 flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-slate-500">{labels.average}</p>
                                    <p className="mt-1 text-2xl font-black text-white">{formatDuration(service.average_minutes_30d, language)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-slate-500">{labels.completed}</p>
                                    <p className="mt-1 text-lg font-black text-indigo-300">{completedInChart}</p>
                                </div>
                            </div>
                            {chart.some((point) => point.completed > 0) ? (
                                <div className="flex h-44 items-end gap-1.5 border-b border-white/8 pt-4">
                                    {chart.map((point, index) => {
                                        const height = point.average_minutes > 0 ? Math.max(8, (point.average_minutes / maxChartValue) * 100) : 2;
                                        return (
                                            <div key={point.day} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
                                                <div className="relative flex flex-1 items-end justify-center">
                                                    <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-[0.5625rem] shadow-xl group-hover:block">
                                                        <p className="font-bold text-white">{formatDuration(point.average_minutes, language)}</p>
                                                        <p className="mt-0.5 text-slate-400">{point.completed} · {labels.completed.toLowerCase()}</p>
                                                    </div>
                                                    <div className={`w-full max-w-4 rounded-t-sm ${point.completed > 0 ? 'bg-linear-to-t from-indigo-600 to-cyan-300' : 'bg-white/5'}`} style={{height: `${height}%`}}/>
                                                </div>
                                                <span className="mt-2 h-4 truncate text-center text-[0.5rem] font-semibold text-slate-500">
                                                    {index % 2 === 0 ? formatTimestamp(point.day, locale, {day: '2-digit', month: '2-digit'}) : ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="grid h-44 place-items-center rounded-xl border border-dashed border-white/10 bg-white/1.5 px-4 text-center text-xs text-slate-500">{labels.noServiceHistory}</div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
                    <div className="dashboard-panel overflow-hidden rounded-2xl">
                        <PanelHeader icon={<Wrench size="1.0625rem"/>} title={labels.queue} subtitle={labels.queueSubtitle}/>
                        {metrics.serviceQueue.length > 0 ? (
                            <div className="grid gap-px bg-white/5.5 sm:grid-cols-2 xl:grid-cols-3">
                                {metrics.serviceQueue.slice(0, 9).map((pallet) => (
                                    <div key={pallet.pallet_id} className="bg-[#101622] p-4 hover:bg-[#131b29]">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-mono text-xs font-black text-white">{pallet.pallet_id}</span>
                                            <StatusBadge pallet={pallet} labels={labels}/>
                                        </div>
                                        <p className="mt-3 truncate text-[0.6875rem] font-semibold text-slate-300">{pallet.project} · {pallet.model}</p>
                                        <div className="mt-2 flex items-center gap-1.5 text-[0.625rem] text-slate-500">
                                            <Clock3 size="0.75rem"/>{labels.waiting}: <span className="font-bold text-slate-300">{formatDuration(elapsedMinutes(pallet.status_changed_at, effectiveNow), language) || labels.justNow}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState icon={<CheckCircle2 size="1.5rem"/>} text={labels.queueEmpty}/>
                        )}
                    </div>

                    <div className="dashboard-panel overflow-hidden rounded-2xl">
                        <PanelHeader icon={<Gauge size="1.0625rem"/>} title={labels.projectLoad} subtitle={labels.projectLoadSubtitle}/>
                        <div className="space-y-4 p-5 sm:p-6">
                            {metrics.projects.map((project) => {
                                const ratio = project.total > 0 ? Math.round((project.attention / project.total) * 100) : 0;
                                return (
                                    <div key={project.name}>
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <span className="truncate text-xs font-bold text-slate-200">{project.name}</span>
                                            <span className="shrink-0 font-mono text-[0.625rem] text-slate-400"><strong className={project.attention ? 'text-amber-200' : 'text-emerald-300'}>{project.attention}</strong> / {project.total}</span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                                            <div className={`h-full rounded-full ${ratio >= 40 ? 'bg-rose-400' : ratio > 0 ? 'bg-amber-300' : 'bg-emerald-400'}`} style={{width: `${Math.max(project.attention ? 3 : 0, ratio)}%`}}/>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                    </>
                )}

                <footer className="flex items-center justify-center border-t border-white/5.5 py-3 text-[0.625rem] uppercase tracking-[0.16em] text-slate-600 sm:justify-end">
                    <span className="flex items-center gap-1.5"><RefreshCw size="0.6875rem"/> AUTO REFRESH · 30s</span>
                </footer>
            </main>
        </div>
    );
};

const StatusBadge: React.FC<{pallet: PublicDashboardPallet; labels: DashboardStatusLabels}> = ({pallet, labels}) => {
    const style = statusStyle[pallet.status];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.625rem] font-black uppercase tracking-wide ${style.badge}`}>
            {style.icon}{statusLabel(pallet.status, labels)}
        </span>
    );
};

const EmptyState: React.FC<{icon: React.ReactNode; text: string}> = ({icon, text}) => (
    <div className="grid min-h-44 place-items-center p-8 text-center">
        <div>
            <div className="mx-auto grid size-11 place-items-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">{icon}</div>
            <p className="mt-3 text-xs font-semibold text-slate-400">{text}</p>
        </div>
    </div>
);
