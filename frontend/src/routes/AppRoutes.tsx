import React, {useCallback, useMemo} from 'react';
import {Navigate, Route, Routes} from 'react-router-dom';
import {Pallet, PalletModel, Project} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext.tsx';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {asPallet, publicApi} from '../lib/api.ts';

import {MainLayout} from '../layout/MainLayout.tsx'
import {AdminPanelView as AdminPanel} from '../views/AdminPanelView.tsx';
import {OperatorPanelView as OperatorPanel} from '../views/OperatorPanelView.tsx';
import {MaintenancePanelView as MaintenancePanel} from '../views/MaintenancePanelView.tsx';
import {LiveMonitorView as LiveMonitor} from '../views/LiveMonitorView.tsx';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {PalletHistoryView} from '../views/PalletHistoryView.tsx';
import {DirectoryView} from '../views/DirectoryView.tsx';

export const AppRoutes: React.FC = () => {
    const {apiClient, hasITDepartmentAccess, canManagePallets, isMaintenanceOnly, canAccessMaintenance, defaultPath} = useAuth();
    const {language, t} = useTranslation();
    const queryClient = useQueryClient();
    const palletsKey = useMemo(() => ['pallets', language] as const, [language]);
    const projectsKey = useMemo(() => ['projects', language] as const, [language]);
    const modelsKey = useMemo(() => ['models', language] as const, [language]);

    const palletsQuery = useQuery({
        queryKey: palletsKey,
        queryFn: async () => {
            const pallets: Pallet[] = [];
            let afterId: number | undefined;
            do {
                const page = await apiClient.pallet.GetAllPallets({
                    limit: 200,
                    after_id: afterId,
                    acceptLanguage: language,
                });
                pallets.push(...page.pallets.map(asPallet));
                afterId = page.next_cursor;
            } while (afterId !== undefined);
            return {pallets};
        },
        refetchInterval: 100_000,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });

    const projectsQuery = useQuery({
        queryKey: projectsKey,
        queryFn: () => publicApi.pallet.GetAllProjects(),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const modelsQuery = useQuery({
        queryKey: modelsKey,
        queryFn: () => publicApi.pallet.GetAllModels(),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const pallets = palletsQuery.data?.pallets ?? [];
    const projects = projectsQuery.data?.projects ?? [];
    const models: PalletModel[] = modelsQuery.data?.models ?? [];
    const setPallets = useCallback<React.Dispatch<React.SetStateAction<Pallet[]>>>((update) => {
        queryClient.setQueryData<{pallets: Pallet[]}>(palletsKey, (current) => {
            const currentPallets = current?.pallets ?? [];
            return {pallets: typeof update === 'function' ? update(currentPallets) : update};
        });
    }, [palletsKey, queryClient]);
    const setProjects = useCallback<React.Dispatch<React.SetStateAction<Project[]>>>((update) => {
        queryClient.setQueryData<{projects: Project[]}>(projectsKey, (current) => {
            const currentProjects = current?.projects ?? [];
            return {projects: typeof update === 'function' ? update(currentProjects) : update};
        });
    }, [projectsKey, queryClient]);

    return (
        <>
            {(palletsQuery.isError || projectsQuery.isError || modelsQuery.isError) && (
                <div role="alert" className="fixed top-3 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-950 px-4 py-2 text-sm text-red-100 shadow-xl">
                    {t('fetch_error_banner')}
                </div>
            )}
            <Routes>
            <Route element={<MainLayout/>}>
                <Route path="/" element={<Navigate to={defaultPath} replace/>}/>

                {hasITDepartmentAccess && <Route path="/directory" element={<DirectoryView/>}/>}

                {canManagePallets && (
                    <>
                        <Route
                            path="/admin"
                            element={<AdminPanel pallets={pallets} projects={projects} models={models} setPallets={setPallets}
                                                 setProjects={setProjects}/>}
                        />
                        <Route
                            path="/admin/pallets/:palletId/history"
                            element={<PalletHistoryView/>}
                        />
                    </>
                )}

                {!isMaintenanceOnly && <Route path="/operator" element={<OperatorPanel/>}/>}

                {canAccessMaintenance && (
                    <Route path="/maintenance" element={<MaintenancePanel pallets={pallets}/>}/>
                )}

                {!isMaintenanceOnly && <Route path="/live" element={<LiveMonitor pallets={pallets} projects={projects}/>}/>}
            </Route>

            <Route path="*" element={<Navigate to={defaultPath} replace/>}/>
            </Routes>
        </>
    );
};
