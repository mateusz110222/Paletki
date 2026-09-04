import React from 'react';
import {Factory, LayoutGrid} from 'lucide-react';
import {Link} from 'react-router-dom';
import type {ProductionStation} from '@backend/shared/types';
import {LanguageSwitcher, useTranslation} from '../i18n/LanguageContext.tsx';

interface StationSelectionViewProps {
    stations: ProductionStation[];
    invalidSelection: boolean;
    onSelect: (station: string) => void;
    onSelectAll: () => void;
}

export const StationSelectionView: React.FC<StationSelectionViewProps> = ({
    stations,
    invalidSelection,
    onSelect,
    onSelectAll,
}) => {
    const {t} = useTranslation();

    return (
        <div className="dashboard-public min-h-screen px-5 py-10 text-white sm:px-8">
            <div className="mx-auto max-w-5xl">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="grid size-12 place-items-center rounded-2xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-300">
                            <Factory size={23}/>
                        </div>
                        <div>
                            <p className="text-sm font-black tracking-[0.16em]">PALLETX</p>
                            <p className="mt-0.5 text-xs text-slate-400">{t('dashboard_public_mode')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher/>
                        <Link to="/" className="rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 text-[10px] font-bold text-slate-200 hover:bg-white/8">
                            {t('dashboard_staff_panel')}
                        </Link>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{t('dashboard_choose_station')}</h1>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">{t('dashboard_choose_station_hint')}</p>
                    {invalidSelection && (
                        <p className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-xs font-semibold text-amber-200">
                            {t('dashboard_station_unavailable')}
                        </p>
                    )}
                </div>

                <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <button
                        type="button"
                        onClick={onSelectAll}
                        className="dashboard-panel group rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-fuchsia-400/35"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="grid size-9 place-items-center rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200"><LayoutGrid size={17}/></span>
                            <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-fuchsia-200">ALL</span>
                        </div>
                        <p className="mt-5 text-base font-black text-white">{t('dashboard_all_lines')}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{t('dashboard_all_lines_hint')}</p>
                    </button>

                    {stations.map((station) => (
                        <button
                            key={station.station}
                            type="button"
                            onClick={() => onSelect(station.station)}
                            className="dashboard-panel group rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-400/35"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1.5 font-mono text-xs font-black text-indigo-200">{station.station}</span>
                                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]"/>
                            </div>
                            <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{t('dashboard_current_project')}</p>
                            <p className="mt-1 truncate text-base font-black text-white">{station.project}</p>
                            <p className="mt-1 truncate text-xs text-slate-400">{station.pallet_id} · {station.model}</p>
                        </button>
                    ))}
                </div>
                {stations.length === 0 && (
                    <div className="dashboard-panel mx-auto mt-9 max-w-xl rounded-2xl p-8 text-center text-sm text-slate-400">
                        {t('dashboard_no_stations')}
                    </div>
                )}
            </div>
        </div>
    );
};
