import {useEffect, useState} from 'react';
import {Pallet} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';

interface UseLiveMonitorProps {
    pallets: Pallet[];
}

export const useLiveMonitor = ({pallets}: UseLiveMonitorProps) => {
    const {t} = useTranslation();
    const [time, setTime] = useState(new Date());
    const [progress, setProgress] = useState(45);
    const [activeCycleSimulator, setActiveCycleSimulator] = useState(false);

    // Update Clock Live
    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Next Auto-Refresh bar cycle animation
    useEffect(() => {
        const progressTimer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) return 0;
                return prev + 1;
            });
        }, 300);
        return () => clearInterval(progressTimer);
    }, []);

    const totalPallets = pallets.length;
    const availableCount = pallets.filter((p) => p.status === 'Active').length;
    const inServiceCount = pallets.filter((p) => p.status === 'Washing_Required' || p.status === 'Damaged').length;

    const getProjectReadyCount = (projectName: string) => {
        return pallets.filter((p) => p.project === projectName && p.status === 'Active').length;
    };

    const getProjectTotalCount = (projectName: string) => {
        return pallets.filter((p) => p.project === projectName).length;
    };

    const warningPallets = pallets
        .map((p) => {
            const margin = p.max_cycles - p.current_cycles;
            return {...p, margin};
        })
        .filter((p) => p.status === 'Active' && p.margin <= 100)
        .sort((a, b) => a.margin - b.margin);

    return {
        data: {
            time,
            progress,
            activeCycleSimulator,
            totalPallets,
            availableCount,
            inServiceCount,
            warningPallets,
            pallets,
        },
        actions: {
            setActiveCycleSimulator,
            getProjectReadyCount,
            getProjectTotalCount,
        },
    };
};
