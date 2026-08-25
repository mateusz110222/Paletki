import React, {lazy, Suspense, useEffect, useState} from 'react';
import {Navigate, Route, Routes} from 'react-router-dom';
import {Pallet, Project} from '@backend/shared/types';
import {API_BASE_URL} from '@backend/shared/API_BASE_URL.ts';
import {useAuth} from '../auth/AuthContext.tsx';

import {MainLayout} from '../layout/MainLayout.tsx'
import {AdminPanelView as AdminPanel} from '../views/AdminPanelView.tsx';
import {OperatorPanelView as OperatorPanel} from '../views/OperatorPanelView.tsx';
import {MaintenancePanelView as MaintenancePanel} from '../views/MaintenancePanelView.tsx';
import {LiveMonitorView as LiveMonitor} from '../views/LiveMonitorView.tsx';
import {useTranslation} from '../i18n/LanguageContext.tsx';

const PalletHistoryView = lazy(() => import('../views/PalletHistoryView.tsx').then(
    (module) => ({default: module.PalletHistoryView}),
));

export const AppRoutes: React.FC = () => {
    const {hasITDepartmentAccess} = useAuth();
    const {language} = useTranslation();
    const [pallets, setPallets] = useState<Pallet[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        let isMounted = true;
        const fetchPallets = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/pallets`, {
                    headers: {"Accept-Language": language},
                });
                if (!response.ok) throw new Error('Network error');
                const data = await response.json();
                if (isMounted) setPallets(data.pallets || []);
            } catch {
                if (isMounted) setPallets([]);
            }
        };

        void fetchPallets();
        const interval = setInterval(fetchPallets, 100000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [language]);

    useEffect(() => {
        let isMounted = true;
        const fetchProjects = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/projects`, {
                    headers: {"Accept-Language": language},
                });
                if (!response.ok) throw new Error('Network error');
                const data = await response.json();
                if (isMounted) setProjects(data.projects || []);
            } catch {
                if (isMounted) setProjects([]);
            }
        };

        void fetchProjects();
        return () => {
            isMounted = false;
        };
    }, [language]);

    return (
        <Routes>
            <Route element={<MainLayout/>}>
                <Route path="/" element={<Navigate to={hasITDepartmentAccess ? "/admin" : "/operator"} replace/>}/>

                {hasITDepartmentAccess && (
                    <>
                        <Route
                            path="/admin"
                            element={<AdminPanel pallets={pallets} projects={projects} setPallets={setPallets}
                                                 setProjects={setProjects}/>}
                        />
                        <Route
                            path="/admin/pallets/:palletId/history"
                            element={(
                                <Suspense fallback={(
                                    <div className="space-y-4 animate-pulse">
                                        <div className="h-32 rounded-2xl border border-brand-border bg-brand-surface"/>
                                        <div className="h-20 rounded-xl border border-brand-border bg-brand-surface"/>
                                    </div>
                                )}>
                                    <PalletHistoryView/>
                                </Suspense>
                            )}
                        />
                    </>
                )}

                <Route path="/operator" element={<OperatorPanel setPallets={setPallets}/>}/>

                {hasITDepartmentAccess && (
                    <Route path="/maintenance" element={<MaintenancePanel pallets={pallets} setPallets={setPallets}/>}/>
                )}

                <Route path="/live" element={<LiveMonitor pallets={pallets}/>}/>
            </Route>

            <Route path="*" element={<Navigate to={hasITDepartmentAccess ? "/admin" : "/operator"} replace/>}/>
        </Routes>
    );
};
