import React from 'react';
import {AlertTriangle, Cpu, Database, Info, Radio, RefreshCw, TrendingDown, UserCheck} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {Pallet} from '@backend/shared/types.ts';
import {useLiveMonitor} from '../hooks/useLiveMonitor.ts';

interface LiveMonitorViewProps {
    pallets: Pallet[];
}

export const LiveMonitorView: React.FC<LiveMonitorViewProps> = (props) => {
    const {data, actions} = useLiveMonitor(props);
    const {t} = useTranslation();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" id="live-monitor-container">
            {/* Real-time Header Info */}
            <div
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-brand-surface p-6 rounded-xl border border-brand-border">
                <div>
                    <h2 className="text-xl font-black text-brand-text flex items-center gap-2 uppercase tracking-tight">
                        <Radio className="text-brand-accent animate-pulse" size={24}/>
                        {t('live_monitor_title')}
                    </h2>
                    <p className="text-xs text-brand-text-muted mt-1 font-medium">{t('live_monitor_subtitle')}</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest">{t('current_shift_time')}</p>
                        <p className="text-2xl font-mono font-bold text-brand-accent">{data.time.toLocaleTimeString()}</p>
                    </div>
                </div>
            </div>

            {/* Bento Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Total Stock */}
                <div
                    className="bg-brand-surface p-6 rounded-xl border border-brand-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Database size={64}/>
                    </div>
                    <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('stats_total_registered')}</p>
                    <p className="text-4xl font-black text-brand-text mt-2">{data.totalPallets}</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-brand-bg rounded-full overflow-hidden">
                            <div className="h-full bg-brand-accent w-full"></div>
                        </div>
                        <span className="text-[10px] font-bold text-brand-text-muted">100%</span>
                    </div>
                </div>

                {/* Available for Production */}
                <div
                    className="bg-brand-surface p-6 rounded-xl border border-brand-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <UserCheck size={64}/>
                    </div>
                    <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('stats_ready_for_prod')}</p>
                    <p className="text-4xl font-black text-green-400 mt-2">{data.availableCount}</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-brand-bg rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 transition-all duration-1000"
                                style={{width: `${(data.availableCount / data.totalPallets) * 100}%`}}
                            ></div>
                        </div>
                        <span className="text-[10px] font-bold text-brand-text-muted">
              {data.totalPallets > 0 ? Math.round((data.availableCount / data.totalPallets) * 100) : 0}%
            </span>
                    </div>
                </div>

                {/* Maintenance / Broken */}
                <div
                    className="bg-brand-surface p-6 rounded-xl border border-brand-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Cpu size={64}/>
                    </div>
                    <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('stats_in_maintenance')}</p>
                    <p className="text-4xl font-black text-red-400 mt-2">{data.inServiceCount}</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-brand-bg rounded-full overflow-hidden">
                            <div
                                className="h-full bg-red-500 transition-all duration-1000"
                                style={{width: `${(data.inServiceCount / data.totalPallets) * 100}%`}}
                            ></div>
                        </div>
                        <span className="text-[10px] font-bold text-brand-text-muted">
              {data.totalPallets > 0 ? Math.round((data.inServiceCount / data.totalPallets) * 100) : 0}%
            </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Project Health Status */}
                <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
                    <div
                        className="px-6 py-4 border-b border-brand-border flex justify-between items-center bg-brand-surface/50">
                        <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                            <RefreshCw size={16} className="text-brand-accent"/>
                            {t('project_health_monitor')}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span
                                className="text-[10px] font-bold text-brand-text-muted uppercase">{t('next_refresh')}</span>
                            <div className="w-16 h-1 bg-brand-bg rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-brand-accent transition-all duration-300"
                                    style={{width: `${data.progress}%`}}
                                ></div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-5">
                        {['SMT-LINE-A', 'SMT-LINE-B', 'EV-BATTERY-PACK', 'PROTOTYPE-X'].map((proj) => {
                            const ready = actions.getProjectReadyCount(proj);
                            const total = actions.getProjectTotalCount(proj);
                            const percentage = total > 0 ? (ready / total) * 100 : 0;

                            return (
                                <div key={proj} className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xs font-bold text-brand-text">{proj}</p>
                                            <p className="text-[10px] text-brand-text-muted font-mono">{ready} / {total} {t('pallets_ready')}</p>
                                        </div>
                                        <span
                                            className={`text-xs font-black ${percentage > 80 ? 'text-green-400' : percentage > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {Math.round(percentage)}%
                    </span>
                                    </div>
                                    <div
                                        className="h-2 w-full bg-brand-bg rounded-full overflow-hidden border border-brand-border/30 p-[1px]">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${percentage > 80 ? 'bg-green-500' : percentage > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{width: `${percentage}%`}}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Maintenance Warnings */}
                <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
                    <div className="px-6 py-4 border-b border-brand-border bg-red-500/5">
                        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                            <AlertTriangle size={16}/>
                            {t('critical_maintenance_alerts')}
                        </h3>
                    </div>
                    <div className="p-0 max-h-[340px] overflow-y-auto">
                        {data.warningPallets.length === 0 ? (
                            <div className="p-10 text-center flex flex-col items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                                    <UserCheck size={24}/>
                                </div>
                                <p className="text-xs font-medium text-brand-text-muted">{t('no_critical_alerts')}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-brand-border">
                                {data.warningPallets.map((p: any) => (
                                    <div key={p.pallet_id}
                                         className="p-4 hover:bg-brand-surface-high/50 transition-colors flex justify-between items-center group">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${p.margin < 30 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                                                {p.margin}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-brand-text group-hover:text-brand-accent transition-colors">{p.pallet_id}</p>
                                                <p className="text-[10px] text-brand-text-muted font-bold uppercase">{p.project} • {p.model}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                      <span
                          className="px-2 py-0.5 rounded text-[9px] font-black bg-brand-surface-high border border-brand-border text-brand-text-muted uppercase tracking-tighter">
                        {t('cycles_left')}
                      </span>
                                            <div className="flex items-center gap-1 text-red-400">
                                                <TrendingDown size={12}/>
                                                <span
                                                    className="text-[10px] font-mono font-bold">{p.current_cycles} / {p.max_cycles}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {data.warningPallets.length > 0 && (
                        <div
                            className="p-4 bg-brand-surface-high/50 border-t border-brand-border flex items-center gap-2 text-[10px] text-brand-text-muted italic">
                            <Info size={12} className="text-brand-accent"/>
                            {t('maintenance_auto_warning_msg')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};