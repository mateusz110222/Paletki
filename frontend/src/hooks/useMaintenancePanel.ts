import {useSearchParams} from 'react-router';
import {useToast} from '../components/ToastProvider';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {getErrorMessage} from '../lib/errors.ts';
import {refreshPalletData} from '../lib/queryCache.ts';
import {Pallet, PalletStatus} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useAuth} from '../auth/AuthContext.tsx';
import {useQueryClient} from '@tanstack/react-query';
import {getMaintenanceQueues} from '../lib/maintenanceQueue';
import {matchesPalletSearch} from '../lib/palletSearch';

interface UseMaintenancePanelProps {
    pallets: Pallet[];
}

export function useMaintenancePanel({pallets}: UseMaintenancePanelProps) {
    const notify = useToast();
    const {t, language} = useTranslation();
    const {apiClient} = useAuth();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<keyof ReturnType<typeof getMaintenanceQueues>>('queue');
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);
    const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
    const [repairDescription, setRepairDescription] = useState('');
    const [modalError, setModalError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitting = useRef(false);
    const [searchParams] = useSearchParams();
    const searchTermFromURL = searchParams.get('searchTerm') || '';

    const queues = useMemo(() => getMaintenanceQueues(pallets), [pallets]);
    const visiblePallets = queues[activeTab].filter(pallet => matchesPalletSearch(pallet, searchTermFromURL));

    const handleOpenServiceLog = (pallet: Pallet) => {
        setSelectedPallet(pallet);
        setRepairDescription('');
        setModalError('');
    };

    const changeSelectedPalletStatus = async (newStatus: PalletStatus, resetCycles: boolean) => {
        if (!selectedPallet || submitting.current) return;
        setModalError('');

        if (!repairDescription.trim()) {
            setModalError(t('maint_modal_error_comment_required'));
            return;
        }

        submitting.current = true;
        setIsSubmitting(true);
        try {
            await apiClient.pallet.ChangePalletStatus({
                pallet_id: selectedPallet.pallet_id,
                new_status: newStatus,
                block_reason: repairDescription.trim(),
                reset_cycles: resetCycles,
                acceptLanguage: language,
            });

            await refreshPalletData(queryClient);
            setSelectedPallet(null);
            notify(language === 'pl' ? 'Zapisano obsługę palety.' : 'Pallet service saved.');
        } catch (error: unknown) {
            console.error('Error returning pallet to production:', error);
            setModalError(getErrorMessage(error, t('error_connecting_to_encore')));
        } finally {
            submitting.current = false;
            setIsSubmitting(false);
        }
    };

    const handleServiceLogSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        await changeSelectedPalletStatus('Active', true);
    };

    const handleReportDamage = async () => {
        await changeSelectedPalletStatus('Damaged', false);
    };

    return {
        data: {
            searchTermFromURL,
            activeTab,
            selectedPallet,
            repairDescription,
            modalError,
            isSubmitting,
            queues, visiblePallets, now,
        },
        actions: {
            setActiveTab,
            closeServiceLog: () => {if (!submitting.current) setSelectedPallet(null);},
            setRepairDescription,
            handleOpenServiceLog,
            handleServiceLogSubmit,
            handleReportDamage,
        },
    };
}
