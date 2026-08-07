import {useEffect, useMemo, useState} from 'react';
import {Pallet} from '@backend/shared/types';

interface UseLiveMonitorProps {
    pallets: Pallet[];
}

export const useLiveMonitor = ({pallets}: UseLiveMonitorProps) => {
    const [progress, setProgress] = useState(45);

    useEffect(() => {
        const progressTimer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) return 0;
                return prev + 1;
            });
        }, 300);
        return () => clearInterval(progressTimer);
    }, []);

    const projects = useMemo(() => {
        const uniqueProjects = Array.from(
            new Set(pallets.map((p) => p.project))
        );
        return uniqueProjects.sort((a, b) => a.localeCompare(b));
    }, [pallets]);

    const inServiceCount = pallets.filter(
        (p) => p.status === 'Washing_Required' || p.status === 'Damaged'
    ).length;

    const getProjectReadyCount = (projectName: string) => {
        return pallets.filter((p) => p.project === projectName && p.status === 'Active').length;
    };

    const getProjectTotalCount = (projectName: string) => {
        return pallets.filter((p) => p.project === projectName).length;
    };

    return {
        data: {
            progress,
            inServiceCount,
            pallets,
            projects,
        },
        actions: {
            getProjectReadyCount,
            getProjectTotalCount,
        },
    };
};