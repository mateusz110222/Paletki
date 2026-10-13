import {lazyBundle} from '../lib/lazyBundle';
import {ViewBoundary} from '../components/ViewBoundary';

import React, {lazy, useCallback, useMemo} from 'react';
import {Navigate, Route, Routes, useLocation} from 'react-router';
import {Pallet, PalletModel, Project} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext.tsx';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {asPallet, publicApi} from '../lib/api.ts';
import {loadPalletPages} from '../lib/palletPages';

import {MainLayout} from '../layout/MainLayout.tsx'

import {useTranslation} from '../i18n/LanguageContext.tsx';

import {LoginView} from '../views/LoginView.tsx';

const operatorBundle = lazyBundle(() => import('./bundles/operator'));
const maintenanceBundle = lazyBundle(() => import('./bundles/maintenance'));
const dashboardsBundle = lazyBundle(() => import('./bundles/dashboards'));
const adminBundle = lazyBundle(() => import('./bundles/admin'));

const PalletHistoryLookupView = maintenanceBundle.view('PalletHistoryLookupView');
const WashingScannerView = maintenanceBundle.view('WashingScannerView');
const DashboardHubView = dashboardsBundle.view('DashboardHubView');
const MaintenanceHubView = maintenanceBundle.view('MaintenanceHubView');
const DefectCatalogView = maintenanceBundle.view('DefectCatalogView');
const ReportsView = maintenanceBundle.view('ReportsView');
const AdminPanel = adminBundle.view('AdminPanelView');
const OperatorPanel = operatorBundle.view('OperatorPanelView');
const MaintenancePanel = maintenanceBundle.view('MaintenancePanelView');
const AdminPalletHistoryView = adminBundle.view('PalletHistoryView');
const PalletHistoryView = maintenanceBundle.view('PalletHistoryView');
const CatalogView = adminBundle.view('CatalogView');
const DirectoryView = adminBundle.view('DirectoryView');
const PublicDashboardView = dashboardsBundle.view('PublicDashboardView');
const LiveMonitorView = dashboardsBundle.view('LiveMonitorView');
const DocumentationView = lazy(() => import('../views/DocumentationView.tsx').then(module => ({default: module.DocumentationView})));

export const AppRoutes: React.FC = () => {
    const {isAuthenticated} = useAuth();

    return (
        <ViewBoundary><Routes>
            <Route path="/dashboards" element={<DashboardHubView/>}/>
            <Route path="/live" element={<LiveMonitorView/>}/>
            <Route path="/dashboard" element={<PublicDashboardView/>}/>
            <Route path="/*" element={isAuthenticated ? <AuthenticatedRoutes/> : <LoginView/>}/>
        </Routes></ViewBoundary>
    );
};

const AuthenticatedRoutes: React.FC = () => {
    const {apiClient, hasITDepartmentAccess, canManagePallets, isMaintenanceOnly, canAccessMaintenance, defaultPath} = useAuth();
    const {language, t} = useTranslation();
    const pathname = useLocation().pathname;
    const needsPallets = (pathname === '/admin' && canManagePallets) || (pathname === '/maintenance/service' && canAccessMaintenance);
    const needsCatalog = pathname === '/admin' && canManagePallets;
    const queryClient = useQueryClient();
    const palletsKey = useMemo(() => ['pallets', language] as const, [language]);
    const projectsKey = useMemo(() => ['projects', language] as const, [language]);
    const modelsKey = useMemo(() => ['models', language] as const, [language]);

    const palletsQuery = useQuery({
        enabled: needsPallets,
        queryKey: palletsKey,
        queryFn: async () => {
            const records = await loadPalletPages(afterId => apiClient.pallet.GetAllPallets({
                limit: 200,
                after_id: afterId,
                acceptLanguage: language,
            }));
            const pallets = records.map(asPallet);
            return {pallets};
        },
        refetchInterval: 100_000,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });

    const projectsQuery = useQuery({
        enabled: needsCatalog,
        queryKey: projectsKey,
        queryFn: () => publicApi.pallet.GetAllProjects(),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const modelsQuery = useQuery({
        enabled: needsCatalog,
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
            {((needsPallets && palletsQuery.isError) || (needsCatalog && (projectsQuery.isError || modelsQuery.isError))) && (
                <div role="alert" className="fixed top-3 left-1/2 z-100 -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-950 px-4 py-2 text-sm text-red-100 shadow-xl">
                    {t('fetch_error_banner')}
                </div>
            )}
            <Routes>
            <Route element={<MainLayout/>}>
                <Route path="/" element={<Navigate to={defaultPath} replace/>}/>
                <Route path="/documentation" element={<DocumentationView/>}/>

                {hasITDepartmentAccess && <Route path="/directory" element={<DirectoryView/>}/>}

                {canManagePallets && (
                    <>
                        <Route
                            path="/catalog" element={<CatalogView/>}/>
                        <Route
                            path="/admin"
                            element={<AdminPanel pallets={pallets} projects={projects} models={models} setPallets={setPallets}
                                                 setProjects={setProjects}/>}
                        />
                        <Route
                            path="/admin/pallets/:palletId/history"
                            element={<AdminPalletHistoryView/>}
                        />
                    </>
                )}

                {!isMaintenanceOnly && <Route path="/operator" element={<OperatorPanel/>}/>}

                {canAccessMaintenance && <Route path="/reports" element={<ReportsView/>}/>}
                {canAccessMaintenance && (
                    <>
                        <Route path="/maintenance" element={<MaintenanceHubView/>}/>
                        <Route path="/maintenance/service" element={<MaintenancePanel pallets={pallets}/>}/>
                        <Route path="/maintenance/washing" element={<WashingScannerView/>}/>
                        <Route path="/maintenance/history" element={<PalletHistoryLookupView/>}/>
                        <Route path="/maintenance/pallets/:palletId/history" element={<PalletHistoryView backPath="/maintenance/history"/>}/>
                        <Route path="/maintenance/defects" element={<DefectCatalogView/>}/>
                    </>
                )}

            </Route>

            <Route path="*" element={<Navigate to={defaultPath} replace/>}/>
            </Routes>
        </>
    );
};
