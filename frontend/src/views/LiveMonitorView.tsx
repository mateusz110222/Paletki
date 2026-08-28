import React from 'react';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Package,
    Search,
    ShieldAlert,
    Wrench
} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {Pallet, Project} from '@backend/shared/types.ts';
import {MonitorSortOption, ProjectStats, useLiveMonitor} from '../hooks/useLiveMonitor.ts';
import {
    formatAvailablePallets,
    formatPalletsCount,
    formatProjectsCount
} from '../i18n/pluralization.ts';

interface LiveMonitorViewProps {
    pallets: Pallet[];
    projects?: Project[];
}

export const LiveMonitorView: React.FC<LiveMonitorViewProps> = (props) => {
    const {data, actions} = useLiveMonitor(props);
    const {t, language} = useTranslation();

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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" id="live-monitor-container">
            {/* Top Fleet Health Summary Bento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Header & Filter Controls Section */}
            <div className="bg-brand-surface rounded-xl border border-brand-border p-4 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                    {/* Title */}
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-accent/10 rounded-lg text-brand-accent border border-brand-accent/20 shrink-0">
                            <Activity size={20}/>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-brand-text tracking-wide uppercase">
                                {t('project_health_monitor')}
                            </h3>
                            <p className="text-xs text-brand-text-muted mt-0.5">
                                {data.projects.length === data.totalProjectsCount
                                    ? formatProjectsCount(data.totalProjectsCount, language)
                                    : `${data.projects.length} z ${formatProjectsCount(data.totalProjectsCount, language)}`}
                            </p>
                        </div>
                    </div>

                    {/* Search & Sort Controls */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search project */}
                        <div className="relative flex-1 sm:w-60">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" size={14}/>
                            <input
                                type="text"
                                placeholder={t('search_project_placeholder')}
                                value={data.searchQuery}
                                onChange={(e) => actions.setSearchQuery(e.target.value)}
                                className="w-full bg-brand-bg border border-brand-border rounded-lg pl-9 pr-3 py-2 text-xs text-brand-text placeholder:text-brand-text-muted/60 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                            />
                        </div>

                        {/* Sort Dropdown */}
                        <select
                            value={data.sortBy}
                            onChange={(e) => actions.setSortBy(e.target.value as MonitorSortOption)}
                            className="bg-brand-bg border border-brand-border text-xs rounded-lg px-3 py-2 text-brand-text font-medium focus:ring-1 focus:ring-brand-accent shrink-0"
                            aria-label={t('sort_project_name')}
                        >
                            <option value="alphabetical">{t('sort_project_name')}</option>
                            <option value="lowest_health">{t('sort_project_health')}</option>
                            <option value="highest_health">{t('sort_project_name')} (100% → 0%)</option>
                            <option value="most_pallets">{t('fleet_total_pallets')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Dynamic Grid of Project Cards */}
            {data.projects.length === 0 ? (
                <div className="bg-brand-surface rounded-xl border border-brand-border p-12 text-center">
                    <Package size={32} className="mx-auto text-brand-text-muted/40 mb-3"/>
                    <p className="text-sm font-medium text-brand-text-muted">
                        {t('no_registered_projects')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {data.projects.map((proj: ProjectStats) => {
                        const ready = proj.active;
                        const total = proj.total;
                        const unavailable = total - ready;
                        const roundedPercentage = proj.percentage;
                        const theme = getStatusTheme(roundedPercentage, total);

                        return (
                            <div
                                key={proj.name}
                                className={`bg-brand-surface rounded-xl border border-brand-border p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg ${theme.borderAccent} group`}
                            >
                                <div>
                                    {/* Card Top: Title & Status Badge */}
                                    <div className="flex items-start justify-between gap-2 mb-4">
                                        <div className="space-y-1 min-w-0">
                                            <span
                                                className="text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">
                                                {t('project')}
                                            </span>
                                            <h4 className="text-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">
                                                {proj.name}
                                            </h4>
                                        </div>
                                        <div
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shrink-0 ${theme.badgeBg}`}>
                                            {theme.icon}
                                            <span>{total > 0 ? `${roundedPercentage}%` : '—'}</span>
                                        </div>
                                    </div>

                                    {/* Card Stats */}
                                    <div
                                        className="bg-brand-bg/40 rounded-lg p-3 border border-brand-border/30 mb-4 grid grid-cols-2 gap-2 items-center">
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

                                {/* Progress Bar at Bottom */}
                                <div className="space-y-1.5 pt-1">
                                    <div
                                        className="h-2 w-full bg-brand-bg rounded-full overflow-hidden border border-brand-border/30 p-px">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${theme.barBg}`}
                                            style={{width: total > 0 ? `${roundedPercentage}%` : '0%'}}
                                        ></div>
                                    </div>
                                    {total === 0 && (
                                        <p className="text-[10px] text-brand-text-muted text-center italic">
                                            {formatPalletsCount(0, language)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
