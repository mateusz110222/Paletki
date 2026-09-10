

import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useTranslation } from '../i18n/LanguageContext.tsx';
import { useLiveMonitor } from '../hooks/useLiveMonitor.ts';
import { usePublicDashboard } from '../hooks/usePublicDashboard.ts';
import { useDocumentMetadata } from '../hooks/useDocumentMetadata.ts';

import { publicApi } from '../lib/api.ts';

export function useLiveMonitorView() {
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

    return {t, language, setSearchParams, stationFromUrl, query, selectedStation, showAll, stationHistory, recentProjectNames, projectsQuery, data};
}
