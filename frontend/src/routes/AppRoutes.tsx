import React, {useEffect, useState} from 'react';
import {Navigate, Route, Routes} from 'react-router-dom';
import {Pallet, Project} from '@backend/shared/types';
import {API_BASE_URL} from '@backend/shared/API_BASE_URL.ts';
import {useAuth} from '../auth/AuthContext.tsx';

import {MainLayout} from '../layout/MainLayout.tsx'
import {AdminPanelView as AdminPanel} from '../views/AdminPanelView.tsx';
import {OperatorPanelView as OperatorPanel} from '../views/OperatorPanelView.tsx';
import {MaintenancePanelView as MaintenancePanel} from '../views/MaintenancePanelView.tsx';
import {LiveMonitorView as LiveMonitor} from '../views/LiveMonitorView.tsx';

export const AppRoutes: React.FC = () => {
    const {isGuest} = useAuth();
    const [pallets, setPallets] = useState<Pallet[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        let isMounted = true;
        const fetchPallets = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/pallets`);
                if (!response.ok) throw new Error('Network error');
                const data = await response.json();
                if (isMounted) setPallets(data.pallets || []);
            } catch {
                if (isMounted) setPallets([]);
            }
        };

        fetchPallets();
        const interval = setInterval(fetchPallets, 100000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchProjects = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/projects`);
                if (!response.ok) throw new Error('Network error');
                const data = await response.json();
                if (isMounted) setProjects(data.projects || []);
            } catch {
                if (isMounted) setProjects([]);
            }
        };

        fetchProjects();
        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <Routes>
            <Route element={<MainLayout/>}>
                <Route path="/" element={<Navigate to={isGuest ? "/operator" : "/admin"} replace/>}/>

                {!isGuest && (
                    <Route
                        path="/admin"
                        element={<AdminPanel pallets={pallets} projects={projects} setPallets={setPallets}
                                             setProjects={setProjects}/>}
                    />
                )}

                <Route path="/operator" element={<OperatorPanel pallets={pallets} setPallets={setPallets}/>}/>

                {!isGuest && (
                    <Route path="/maintenance" element={<MaintenancePanel pallets={pallets} setPallets={setPallets}/>}/>
                )}

                <Route path="/live" element={<LiveMonitor pallets={pallets}/>}/>
            </Route>

            <Route path="*" element={<Navigate to={isGuest ? "/operator" : "/admin"} replace/>}/>
        </Routes>
    );
};