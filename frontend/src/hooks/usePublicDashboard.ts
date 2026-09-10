import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {PalletStatus, PublicDashboardPallet} from '@backend/shared/types';
import {getPublicDashboard} from '../lib/api.ts';

const cycleProgress = (pallet: PublicDashboardPallet) => (
    pallet.max_cycles > 0 ? Math.min(100, Math.round((pallet.current_cycles / pallet.max_cycles) * 100)) : 0
);

const timestampOrEnd = (value: string) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

export const usePublicDashboard = (station?: string) => {
    const query = useQuery({
        queryKey: ['public-dashboard', station ?? null],
        queryFn: ({signal}) => getPublicDashboard(station, signal),
        refetchInterval: 30_000,
        staleTime: 15_000,
        refetchOnWindowFocus: true,
    });

    const metrics = useMemo(() => {
        const allPallets = query.data?.pallets ?? [];
        const selectedProject = query.data?.scope === 'station'
            ? query.data.selected_station?.project
            : undefined;
        const pallets = selectedProject
            ? allPallets.filter((pallet) => pallet.project === selectedProject)
            : allPallets;
        const operational = pallets.filter((pallet) => pallet.status === 'Active').length;
        const dueSoon = pallets
            .filter((pallet) => pallet.status === 'Active' && cycleProgress(pallet) >= 80)
            .sort((a, b) => cycleProgress(b) - cycleProgress(a));
        const awaitingWash = pallets
            .filter((pallet) => pallet.status === 'Washing_Required')
            .sort((a, b) => timestampOrEnd(a.status_changed_at) - timestampOrEnd(b.status_changed_at));
        const serviceQueue = pallets
            .filter((pallet) => pallet.status !== 'Active')
            .sort((a, b) => timestampOrEnd(a.status_changed_at) - timestampOrEnd(b.status_changed_at));
        const upcoming = [...awaitingWash, ...dueSoon].slice(0, 12);

        const projects = new Map<string, {name: string; total: number; attention: number}>();
        for (const pallet of pallets) {
            const project = projects.get(pallet.project) ?? {name: pallet.project, total: 0, attention: 0};
            project.total += 1;
            if (pallet.status !== 'Active' || cycleProgress(pallet) >= 80) project.attention += 1;
            projects.set(pallet.project, project);
        }

        return {
            total: pallets.length,
            operational,
            availability: pallets.length > 0 ? Math.round((operational / pallets.length) * 100) : 100,
            dueSoon,
            awaitingWash,
            serviceQueue,
            upcoming,
            projects: [...projects.values()]
                .sort((a, b) => b.attention - a.attention || b.total - a.total)
                .slice(0, 6),
        };
    }, [query.data]);

    const selectedStation = query.data?.selected_station;
    const statusCounts = useMemo(() => {
        const counts: Record<PalletStatus, number> = {Active: 0, Washing_Required: 0, Damaged: 0, Blocked: 0};
        for (const pallet of query.data?.pallets ?? []) {
            if (!selectedStation || pallet.project === selectedStation.project) counts[pallet.status] += 1;
        }
        return counts;
    }, [query.data, selectedStation]);

    const service = query.data?.service ?? {daily: [], average_minutes_30d: 0, completed_30d: 0};
    const chart = service.daily;
    const maxChartValue = Math.max(1, ...chart.map((point) => point.average_minutes));
    const completedInChart = chart.reduce((sum, point) => sum + point.completed, 0);
    const stationPallet = selectedStation
        ? query.data?.pallets.find((pallet) => pallet.pallet_id === selectedStation.pallet_id)
        : undefined;
    const stationProgress = stationPallet ? cycleProgress(stationPallet) : 0;
    const stationCyclesRemaining = stationPallet
        ? Math.max(0, stationPallet.max_cycles - stationPallet.current_cycles)
        : 0;
    const stationHasAttention = metrics.serviceQueue.length > 0 || metrics.dueSoon.length > 0;
    const stationPallets = (query.data?.pallets ?? []).filter((pallet) => pallet.project === selectedStation?.project);

    return {
        query,
        metrics,
        cycleProgress,
        statusCounts,
        service,
        chart,
        maxChartValue,
        completedInChart,
        stationPallet,
        stationProgress,
        stationCyclesRemaining,
        stationHasAttention,
        stationPallets,
    };
};
