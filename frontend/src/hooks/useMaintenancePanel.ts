import {useToast} from '../components/ToastProvider';
import React, {useCallback, useMemo, useState} from 'react';
import {getErrorMessage} from '../lib/errors.ts';
import {Pallet, PalletStatus} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useAuth} from '../auth/AuthContext.tsx';
import {useQueryClient} from '@tanstack/react-query';

interface UseMaintenancePanelProps {
    pallets: Pallet[];
}

export function useMaintenancePanel({pallets}: UseMaintenancePanelProps) {
    const notify = useToast();
    const {t, language} = useTranslation();
    const {user, apiClient} = useAuth();
    const queryClient = useQueryClient();

    const Operator = user?.FullName ?? "";
    const [activeTab, setActiveTab] = useState<'repairs' | 'routine'>('repairs');
    const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
    const [repairDescription, setRepairDescription] = useState('');
    const [modalError, setModalError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchPallets = useCallback(async () => {
        await queryClient.invalidateQueries({queryKey: ['pallets']});
    }, [queryClient]);

    if (!user) {
        window.location.href = "/login";
    }

    const repairPallets = useMemo(() => {
        return (pallets || []).filter(p => p.status === 'Damaged');
    }, [pallets]);

    const routinePallets = useMemo(() => {
        return (pallets || []).filter(p => p.status === 'Washing_Required');
    }, [pallets]);

    const filteredRepairPallets = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return repairPallets;
        return repairPallets.filter((p: Pallet) => {
            const palletId = (p.pallet_id || '').toLowerCase();
            const project = (p.project || '').toLowerCase();
            const createdBy = (p.created_by || '').toLowerCase();

            return palletId.includes(query) ||
                project.includes(query) ||
                createdBy.includes(query);
        });
    }, [repairPallets, searchTerm]);

    const filteredRoutinePallets = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return routinePallets;
        return routinePallets.filter((p: Pallet) => {
            const palletId = (p.pallet_id || '').toLowerCase();
            const project = (p.project || '').toLowerCase();
            const createdBy = (p.created_by || '').toLowerCase();

            return palletId.includes(query) ||
                project.includes(query) ||
                createdBy.includes(query);
        });
    }, [routinePallets, searchTerm]);

    const handleOpenServiceLog = (pallet: Pallet) => {
        setSelectedPallet(pallet);
        setRepairDescription('');
        setModalError('');
    };

    const changeSelectedPalletStatus = async (newStatus: PalletStatus, resetCycles: boolean) => {
        setModalError('');

        if (!selectedPallet) return;

        if (!repairDescription.trim()) {
            setModalError(t('maint_modal_error_comment_required'));
            return;
        }

        try {
            await apiClient.pallet.ChangePalletStatus({
                pallet_id: selectedPallet.pallet_id,
                new_status: newStatus,
                block_reason: repairDescription.trim(),
                reset_cycles: resetCycles,
                acceptLanguage: language,
            });

            await fetchPallets();
            setSelectedPallet(null);
            notify(language === 'pl' ? 'Zapisano obsługę palety.' : 'Pallet service saved.');
        } catch (error: unknown) {
            console.error('Error returning pallet to production:', error);
            setModalError(getErrorMessage(error, t('error_connecting_to_encore')));
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
            activeTab,
            selectedPallet,
            repairDescription,
            Operator,
            modalError,
            searchTerm,
            repairPallets,
            routinePallets,
            filteredRepairPallets,
            filteredRoutinePallets
        },
        actions: {
            setActiveTab,
            setSelectedPallet,
            setRepairDescription,
            handleOpenServiceLog,
            handleServiceLogSubmit,
            handleReportDamage,
            setSearchTerm
        },
    };
}
