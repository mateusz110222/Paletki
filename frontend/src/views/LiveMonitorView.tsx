import React from 'react';
import {AlertCircle, AlertTriangle, CheckCircle2, Layers, Package} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {Pallet} from '@backend/shared/types.ts';
import {useLiveMonitor} from '../hooks/useLiveMonitor.ts';

interface LiveMonitorViewProps {
    pallets: Pallet[];
}

export const LiveMonitorView: React.FC<LiveMonitorViewProps> = (props) => {
    const {data, actions} = useLiveMonitor(props);
    const {t} = useTranslation();

    const getStatusTheme = (percentage: number) => {
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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" id="live-monitor-container">
            {/* Header Section */}
            <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="p-2.5 bg-brand-accent/10 rounded-lg text-brand-accent border border-brand-accent/20">
                            <Layers size={20}/>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-brand-text tracking-wide uppercase">
                                {t('project_health_monitor')}
                            </h3>
                            <p className="text-xs text-brand-text-muted mt-0.5">
                                {data.projects.length} {t('active_projects')}
                            </p>
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-3 bg-brand-bg/50 px-3 py-1.5 rounded-lg border border-brand-border/40">
                        <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">
                            {t('next_refresh')}
                        </span>
                        <div
                            className="w-20 h-1.5 bg-brand-bg rounded-full overflow-hidden border border-brand-border/30">
                            <div
                                className="h-full bg-brand-accent transition-all duration-300 rounded-full"
                                style={{width: `${data.progress}%`}}
                            ></div>
                        </div>
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
                    {data.projects.map((proj) => {
                        const ready = actions.getProjectReadyCount(proj);
                        const total = actions.getProjectTotalCount(proj);
                        const unavailable = total - ready;
                        const percentage = total > 0 ? (ready / total) * 100 : 0;
                        const roundedPercentage = Math.round(percentage);
                        const theme = getStatusTheme(roundedPercentage);

                        return (
                            <div
                                key={proj}
                                className={`bg-brand-surface rounded-xl border border-brand-border p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg ${theme.borderAccent} group`}
                            >
                                <div>
                                    {/* Card Top: Title & Status Badge */}
                                    <div className="flex items-start justify-between gap-2 mb-4">
                                        <div className="space-y-1">
                                            <span
                                                className="text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">
                                                {t('project')}
                                            </span>
                                            <h4 className="text-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors line-clamp-1">
                                                {proj}
                                            </h4>
                                        </div>
                                        <div
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${theme.badgeBg}`}>
                                            {theme.icon}
                                            <span>{roundedPercentage}%</span>
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
                                            className={`h-full rounded-full transition-all duration-1000 ${theme.barBg}`}
                                            style={{width: `${percentage}%`}}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};