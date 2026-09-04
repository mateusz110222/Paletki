import React from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
    AlertCircle,
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    LogIn,
    Package,
    RefreshCw,
    ScanBarcode,
    ShieldAlert,
    Tv,
    Wrench
} from 'lucide-react';
import {LanguageSwitcher, useTranslation} from '../i18n/LanguageContext.tsx';
import { ProjectStats, useLiveMonitor} from '../hooks/useLiveMonitor.ts';
import {usePublicDashboard} from '../hooks/usePublicDashboard.ts';
import {useDocumentMetadata} from '../hooks/useDocumentMetadata.ts';
import {StationSelectionView} from '../components/StationSelectionView.tsx';
import {publicApi} from '../lib/api.ts';
import {
    formatAvailablePallets,
    formatPalletsCount,
    formatProjectsCount
} from '../i18n/pluralization.ts';

const formatLastScanTime = (value: string | undefined, language: 'pl' | 'en') => {
    if (!value) return '—';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '—';
    return new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(timestamp));
};

export const LiveMonitorView: React.FC = () => {
    const {t, language} = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const stationFromUrl = searchParams.get('station')?.trim() || undefined;
    const {query} = usePublicDashboard(stationFromUrl);
    const selectedStation = query.data?.selected_station;
    const showAll = query.data?.scope === 'all';
    const stationHistory = query.data?.station_history ?? (selectedStation ? [selectedStation] : []);
    const recentProjectNames = [...new Set(stationHistory.map((entry) => entry.project))];
    const projectsQuery = useQuery({
        queryKey: ['public-projects'],
        queryFn: () => publicApi.pallet.GetAllProjects(),
        staleTime: 60_000,
        refetchInterval: 60_000,
        enabled: showAll,
    });
    const {data} = useLiveMonitor({
        pallets: query.data?.pallets ?? [],
        projects: showAll
            ? projectsQuery.data?.projects ?? []
            : recentProjectNames.map((name) => ({name})),
    });

    useDocumentMetadata(`PalletX | ${t('panel_live_title')}`, t('panel_live_subtitle'), language);

    if (query.isPending || (showAll && projectsQuery.isPending)) {
        return (
            <div className="dashboard-public grid min-h-screen place-items-center p-6 text-white">
                <div className="text-center">
                    <RefreshCw className="mx-auto animate-spin text-indigo-300" size={28}/>
                    <p className="mt-4 text-sm font-semibold text-slate-300">{t('dashboard_loading')}</p>
                </div>
            </div>
        );
    }

    if (query.isError || projectsQuery.isError) {
        return (
            <div className="dashboard-public grid min-h-screen place-items-center p-6 text-white">
                <div className="dashboard-panel max-w-md rounded-2xl p-8 text-center">
                    <AlertTriangle className="mx-auto text-amber-300" size={34}/>
                    <h1 className="mt-4 text-lg font-black">{t('dashboard_error_title')}</h1>
                    <p className="mt-2 text-sm text-slate-400">{t('dashboard_error_hint')}</p>
                    <button type="button" onClick={() => {
                        void query.refetch();
                        if (showAll) void projectsQuery.refetch();
                    }} className="mt-6 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-400">
                        {t('dashboard_retry')}
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

    const getStatusTheme = (percentage: number, total: number) => {
        if (total === 0) {
            return {
                badgeBg: 'bg-brand-surface-high text-brand-text-muted border-brand-border',
                barBg: 'bg-brand-border',
                textColor: 'text-brand-text-muted',
                icon: <Package size={16} className="text-brand-text-muted"/>,
                borderAccent: 'hover:border-brand-border/80',
            };
        }
        if (percentage >= 80) {
            return {
                badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                barBg: 'bg-emerald-500',
                textColor: 'text-emerald-400',
                icon: <CheckCircle2 size={16} className="text-emerald-400"/>,
                borderAccent: 'hover:border-emerald-500/40',
            };
        }
        if (percentage >= 40) {
            return {
                badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                barBg: 'bg-amber-500',
                textColor: 'text-amber-400',
                icon: <AlertTriangle size={16} className="text-amber-400"/>,
                borderAccent: 'hover:border-amber-500/40',
            };
        }
        return {
            badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
            barBg: 'bg-rose-500',
            textColor: 'text-rose-400',
            icon: <AlertCircle size={16} className="text-rose-400"/>,
            borderAccent: 'hover:border-rose-500/40',
        };
    };

    const overallTheme = getStatusTheme(data.fleetSummary.availabilityPercentage, data.fleetSummary.total);
    const projectsByName = new Map(data.projects.map((project) => [project.name, project]));
    const visibleProjects = showAll
        ? data.projects
        : recentProjectNames.flatMap((name) => {
            const project = projectsByName.get(name);
            return project ? [project] : [];
        });
    const stationRowMode = !showAll;
    const latestStationUpdate = stationHistory[0]?.updated_at ?? 'empty';

    return (
        <div className={`${stationRowMode ? 'flex min-h-screen flex-col lg:h-dvh lg:overflow-hidden' : 'min-h-screen'} bg-brand-bg text-brand-text`}>
            <header className="shrink-0 border-b border-brand-border bg-brand-surface/95 backdrop-blur">
                <div className={`mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4 px-5 sm:px-8 ${stationRowMode ? 'py-[clamp(0.55rem,1.35vh,1rem)]' : 'py-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-xl border border-brand-accent/30 bg-brand-accent/10 text-brand-accent"><Tv size={20}/></div>
                        <div>
                            <p className="text-xs font-black tracking-[0.15em] text-brand-accent">PALLETX · LIVE</p>
                            <h1 className="mt-0.5 text-sm font-bold text-brand-text">{t('panel_live_title')}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="hidden rounded-lg border border-brand-accent/20 bg-brand-accent/8 px-3 py-2 text-right sm:block">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-brand-accent">
                                {showAll ? 'ALL' : `${t('dashboard_station')}: ${selectedStation?.station}`}
                            </p>
                            <p className="mt-0.5 max-w-44 truncate text-[10px] font-semibold text-brand-text">
                                {showAll
                                    ? t('dashboard_all_lines')
                                    : visibleProjects.length > 1
                                        ? formatProjectsCount(visibleProjects.length, language)
                                        : selectedStation?.project}
                            </p>
                        </div>
                        <button type="button" onClick={() => setSearchParams({})} className="min-h-10 rounded-lg border border-brand-border bg-brand-bg px-3 text-[10px] font-bold text-brand-text-muted hover:border-brand-accent/50 hover:text-brand-text">
                            {t('dashboard_change_station')}
                        </button>
                        <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 sm:flex"><RefreshCw size={12}/> 30s</span>
                        <LanguageSwitcher/>
                        <Link to={`/dashboard?station=${encodeURIComponent(selectedStation?.station ?? 'ALL')}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-border bg-brand-bg px-3 text-[10px] font-bold text-brand-text-muted hover:border-brand-accent/50 hover:text-brand-text">
                            <BarChart3 size={14}/><span className="hidden sm:inline">{t('nav_public_dashboard')}</span>
                        </Link>
                        <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-border bg-brand-bg px-3 text-[10px] font-bold text-brand-text-muted hover:border-brand-accent/50 hover:text-brand-text">
                            <LogIn size={14}/><span className="hidden sm:inline">{t('dashboard_staff_panel')}</span>
                        </Link>
                    </div>
                </div>
            </header>
            <main className={`mx-auto w-full max-w-[1800px] px-5 sm:px-8 ${stationRowMode ? 'lg:min-h-0 lg:flex-1 lg:py-[clamp(0.55rem,1.45vh,1.5rem)]' : 'py-6'}`}>
        <div className={`${stationRowMode ? 'lg:h-full lg:min-h-0' : 'space-y-6'} animate-in fade-in slide-in-from-bottom-4 duration-300`} id="live-monitor-container">
            {/* Global summary is useful only when several projects are being compared. */}
            {showAll && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Global Health Score */}
                <div className="bg-brand-surface p-5 rounded-xl border border-brand-border flex flex-col justify-between relative overflow-hidden group hover:border-brand-accent/40 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
                            {t('fleet_health_score')}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[9px] font-bold uppercase text-emerald-400">LIVE</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-3">
                        <span className={`text-4xl font-black ${overallTheme.textColor}`}>
                            {data.fleetSummary.availabilityPercentage}%
                        </span>
                    </div>
                    <div className="mt-3 h-1.5 w-full bg-brand-bg rounded-full overflow-hidden border border-brand-border/40">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${overallTheme.barBg}`}
                            style={{width: `${data.fleetSummary.availabilityPercentage}%`}}
                        />
                    </div>
                </div>

                {/* 2. Total Pallets */}
                <div className="bg-brand-surface p-5 rounded-xl border border-brand-border flex flex-col justify-between hover:border-brand-accent/40 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
                            {t('fleet_total_pallets')}
                        </span>
                        <Package size={16} className="text-brand-text-muted"/>
                    </div>
                    <span className="text-4xl font-extrabold text-brand-text mt-3">
                        {data.fleetSummary.total}
                    </span>
                    <span className="text-[10px] font-semibold text-brand-text-muted mt-2">
                        {formatProjectsCount(data.totalProjectsCount, language)}
                    </span>
                </div>

                {/* 3. Operational in loop */}
                <div className="bg-brand-surface p-5 rounded-xl border border-brand-border flex flex-col justify-between hover:border-brand-accent/40 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
                            {t('fleet_operational')}
                        </span>
                        <CheckCircle2 size={16} className="text-emerald-400"/>
                    </div>
                    <span className="text-4xl font-extrabold text-emerald-400 mt-3">
                        {data.fleetSummary.active}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400/90 mt-2">
                        {formatAvailablePallets(data.fleetSummary.active, language)} ({data.fleetSummary.total > 0
                            ? Math.round((data.fleetSummary.active / data.fleetSummary.total) * 100)
                            : 100}%)
                    </span>
                </div>

                {/* 4. In Service / Blocked */}
                <div className="bg-brand-surface p-5 rounded-xl border border-brand-border flex flex-col justify-between hover:border-brand-accent/40 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
                            {t('fleet_in_service')}
                        </span>
                        <Wrench size={16} className="text-amber-400"/>
                    </div>
                    <div className="flex items-baseline gap-3 mt-3">
                        <span className="text-4xl font-extrabold text-amber-400">
                            {data.fleetSummary.damaged + data.fleetSummary.washing + data.fleetSummary.blocked}
                        </span>
                        <div className="flex gap-2 text-[10px] font-mono">
                            {data.fleetSummary.damaged > 0 && (
                                <span className="text-rose-400 font-bold">
                                    {data.fleetSummary.damaged} {t('damaged_status')}
                                </span>
                            )}
                            {data.fleetSummary.blocked > 0 && (
                                <span className="text-red-400 font-bold">
                                    {data.fleetSummary.blocked} <ShieldAlert size={10} className="inline"/>
                                </span>
                            )}
                        </div>
                    </div>
                    <span className="text-[10px] text-brand-text-muted mt-2">
                        {data.fleetSummary.washing > 0 ? `${data.fleetSummary.washing} ${t('cyclic_service')}` : t('maintenance_queue')}
                    </span>
                </div>
            </div>
            )}

            {/* Dynamic Grid of Project Cards */}
            {visibleProjects.length === 0 ? (
                <div className="bg-brand-surface rounded-xl border border-brand-border p-12 text-center">
                    <Package size={32} className="mx-auto text-brand-text-muted/40 mb-3"/>
                    <p className="text-sm font-medium text-brand-text-muted">
                        {t('no_registered_projects')}
                    </p>
                </div>
            ) : (
                <div
                    key={showAll ? 'all-projects' : latestStationUpdate}
                    className={stationRowMode
                        ? 'grid gap-3 lg:h-full lg:min-h-0 lg:grid-rows-3 lg:gap-[clamp(0.5rem,1.2vh,0.85rem)]'
                        : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}
                >
                    {visibleProjects.map((proj: ProjectStats, index) => {
                        const ready = proj.active;
                        const total = proj.total;
                        const unavailable = total - ready;
                        const roundedPercentage = proj.percentage;
                        const theme = getStatusTheme(roundedPercentage, total);
                        const stationEntry = stationHistory.find((entry) => entry.project === proj.name);
                        const isNewest = !showAll && index === 0;

                        return (
                            <div
                                key={proj.name}
                                className={`group relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface transition-all duration-300 hover:shadow-lg ${theme.borderAccent} ${stationRowMode ? 'min-h-60 p-4 lg:h-full lg:min-h-0 lg:p-[clamp(0.65rem,1.35vh,1.25rem)]' : 'flex min-h-64 flex-col justify-between p-5'} ${stationRowMode ? 'live-project-card' : ''} ${isNewest ? 'live-project-card-newest' : ''}`}
                                style={!showAll ? {animationDelay: `${Math.min(index * 70, 350)}ms`} : undefined}
                            >
                                {stationRowMode ? (
                                    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(300px,0.9fr)_minmax(0,1.8fr)] lg:items-center lg:gap-[clamp(0.75rem,1.4vw,1.75rem)]">
                                        <div className="flex min-h-0 flex-col items-center justify-center border-b border-brand-border/60 pb-4 text-center lg:h-full lg:border-r lg:border-b-0 lg:pr-[clamp(0.75rem,1.4vw,1.75rem)] lg:pb-0">
                                            <span className="text-[clamp(0.65rem,1.35vh,0.75rem)] font-bold uppercase tracking-[0.2em] text-brand-text-muted">{t('project')}</span>
                                            <h4 className="mt-[clamp(0.3rem,0.7vh,0.5rem)] w-full truncate text-[clamp(1.75rem,4vh,3rem)] font-black leading-none text-brand-text transition-colors group-hover:text-brand-accent">{proj.name}</h4>
                                            <div className={`mt-[clamp(0.4rem,1vh,1.25rem)] inline-flex items-center gap-2.5 rounded-xl border px-[clamp(0.65rem,1vh,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)] font-mono text-[clamp(2.25rem,5vh,3.75rem)] font-black leading-none ${theme.badgeBg}`}>
                                                {theme.icon}<span>{total > 0 ? `${roundedPercentage}%` : '—'}</span>
                                            </div>
                                        </div>

                                        <div className="flex min-h-0 min-w-0 items-center gap-[clamp(0.65rem,1vw,1rem)] rounded-xl border border-brand-accent/20 bg-brand-bg/60 px-[clamp(0.75rem,1.2vw,1.25rem)] py-[clamp(0.55rem,1.1vh,1.25rem)]">
                                            <div className="grid size-[clamp(2.5rem,5vh,3.5rem)] shrink-0 place-items-center rounded-xl border border-brand-accent/25 bg-brand-accent/10 text-brand-accent">
                                                <ScanBarcode size={28}/>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-accent">{t('dashboard_last_scanned_pallet')}</span>
                                                    {isNewest && <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-400">{t('dashboard_newest')}</span>}
                                                </div>
                                                <p className="mt-[clamp(0.25rem,0.65vh,0.5rem)] truncate font-mono text-[clamp(1.5rem,3.5vh,2.25rem)] font-black tracking-[0.06em] text-brand-text">{stationEntry?.pallet_id ?? '—'}</p>
                                                <p className="mt-1 truncate text-[clamp(0.65rem,1.4vh,0.75rem)] font-semibold uppercase tracking-wide text-brand-text-muted">
                                                    {stationEntry?.model ?? '—'} · {formatLastScanTime(stationEntry?.updated_at, language)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="min-w-0">
                                            <div className="grid h-[clamp(6.25rem,14vh,8.75rem)] grid-cols-4 gap-2 sm:gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                                                {[
                                                    {label: t('status_active'), value: ready, color: 'text-emerald-400', panel: 'border-emerald-500/20 bg-emerald-500/[0.07]', icon: <CheckCircle2 size={24}/>},
                                                    {label: t('status_washing_required'), value: proj.washing, color: 'text-cyan-400', panel: 'border-cyan-500/20 bg-cyan-500/[0.07]', icon: <RefreshCw size={24}/>},
                                                    {label: t('damaged_status'), value: proj.damaged, color: 'text-rose-400', panel: 'border-rose-500/20 bg-rose-500/[0.07]', icon: <Wrench size={24}/>},
                                                    {label: t('status_blocked'), value: proj.blocked, color: 'text-orange-400', panel: 'border-orange-500/20 bg-orange-500/[0.07]', icon: <ShieldAlert size={24}/>},
                                                ].map((metric) => (
                                                    <div key={metric.label} className={`grid min-h-0 min-w-0 grid-rows-[minmax(2.25rem,1fr)_clamp(1.25rem,2.6vh,2rem)_clamp(1.75rem,3.8vh,2.75rem)] place-items-center overflow-hidden rounded-xl border px-2 py-[clamp(0.3rem,0.7vh,0.65rem)] text-center sm:px-3 ${metric.panel}`}>
                                                        <p className={`flex min-h-0 items-center justify-center font-mono text-[clamp(2.1rem,4.8vh,3.75rem)] font-black leading-none ${metric.color}`}>{metric.value}</p>
                                                        <div className={`flex items-center justify-center ${metric.color}`}>{metric.icon}</div>
                                                        <p className={`flex min-h-0 w-full items-center justify-center break-words text-[clamp(0.58rem,1.3vh,0.875rem)] font-black uppercase leading-tight tracking-[0.03em] ${metric.color}`}>{metric.label}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-[clamp(0.35rem,0.8vh,0.75rem)] flex items-center gap-4">
                                                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border border-brand-border/30 bg-brand-bg p-px">
                                                    <div className={`h-full rounded-full transition-all duration-700 ${theme.barBg}`} style={{width: total > 0 ? `${roundedPercentage}%` : '0%'}}/>
                                                </div>
                                                <span className={`shrink-0 font-mono text-[clamp(1.35rem,3vh,1.875rem)] font-black ${theme.textColor}`}>{ready} / {total}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <div className="mb-4 flex items-start justify-between gap-2">
                                                <div className="min-w-0 space-y-1">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted">
                                                        {t('project')}
                                                    </span>
                                                    <h4 className="truncate text-sm font-bold text-brand-text transition-colors group-hover:text-brand-accent">
                                                        {proj.name}
                                                    </h4>
                                                </div>
                                                <div className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${theme.badgeBg}`}>
                                                    {theme.icon}
                                                    <span>{total > 0 ? `${roundedPercentage}%` : '—'}</span>
                                                </div>
                                            </div>

                                            {!showAll && stationEntry && (
                                                <div className="mb-4 rounded-lg border border-brand-accent/20 bg-brand-bg/60 p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex min-w-0 items-center gap-2.5">
                                                            <ScanBarcode size={17} className="shrink-0 text-brand-accent"/>
                                                            <div className="min-w-0">
                                                                <p className="truncate font-mono text-base font-black tracking-[0.06em] text-brand-text">{stationEntry.pallet_id}</p>
                                                                <p className="mt-0.5 truncate text-[10px] font-semibold text-brand-text-muted">{stationEntry.model}</p>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            {isNewest && <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-400">{t('dashboard_newest')}</p>}
                                                            <p className="mt-0.5 text-[10px] font-bold text-brand-text-muted">{formatLastScanTime(stationEntry.updated_at, language)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mb-4 grid grid-cols-2 items-center gap-2 rounded-lg border border-brand-border/30 bg-brand-bg/40 p-3">
                                        <div>
                                            <p className="text-[10px] uppercase font-semibold text-brand-text-muted">
                                                {t('ready_total')}
                                            </p>
                                            <p className="text-lg font-mono font-bold mt-0.5">
                                                <span className={theme.textColor}>{ready}</span>{' '}
                                                <span
                                                    className="text-xs text-brand-text-muted font-normal">/ {total}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-semibold text-brand-text-muted">
                                                {t('unavailable_pallets')}
                                            </p>
                                            <p className={`text-lg font-mono font-bold mt-0.5 ${unavailable > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {unavailable}
                                            </p>
                                        </div>
                                    </div>
                                        </div>

                                        <div className="space-y-1.5 pt-1">
                                            <div className="h-2 w-full overflow-hidden rounded-full border border-brand-border/30 bg-brand-bg p-px">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${theme.barBg}`}
                                                    style={{width: total > 0 ? `${roundedPercentage}%` : '0%'}}
                                                />
                                            </div>
                                            {total === 0 && (
                                                <p className="text-center text-[10px] italic text-brand-text-muted">
                                                    {formatPalletsCount(0, language)}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
            </main>
        </div>
    );
};
