import React, {useCallback, useState} from 'react';
import {Pallet, PalletStatus} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useAuth} from '../auth/AuthContext.tsx';
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";

interface UseMaintenancePanelProps {
    pallets: Pallet[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
}

export function useMaintenancePanel({pallets, setPallets}: UseMaintenancePanelProps) {
    const {t, language} = useTranslation();
    const {user, authenticatedFetch} = useAuth();

    const Operator = user?.FullName ?? "";
    const [activeTab, setActiveTab] = useState<'repairs' | 'routine'>('repairs');
    const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
    const [washConfirm, setWashConfirm] = useState(false);
    const [fluxConfirm, setFluxConfirm] = useState(false);
    const [repairDescription, setRepairDescription] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [modalError, setModalError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchPallets = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/pallets`, {
                headers: {"Accept-Language": language},
            });
            if (res.ok) {
                const data = await res.json();
                setPallets(data.pallets || []);
            }
        } catch (error) {
            console.error("Error fetching pallets:", error);
        }
    }, [language, setPallets]);

    if (!user) {
        window.location.href = "/login";
    }

    const repairPallets = pallets.filter(p => p.status === 'Damaged');
    const routinePallets = pallets.filter(p => p.status === 'Washing_Required');

    const filteredRepairPallets = (repairPallets || []).filter((p: Pallet) => {
        const palletId = p.pallet_id || '';
        const project = p.project || '';
        const createdBy = p.created_by || '';

        return palletId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.toLowerCase().includes(searchTerm.toLowerCase()) ||
            createdBy.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const filteredRoutinePallets = (routinePallets || []).filter((p) => {
        const palletId = p.pallet_id || '';
        const project = p.project || '';
        const createdBy = p.created_by || '';

        return palletId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.toLowerCase().includes(searchTerm.toLowerCase()) ||
            createdBy.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleOpenServiceLog = (pallet: Pallet) => {
        setSelectedPallet(pallet);
        setWashConfirm(false);
        setFluxConfirm(false);
        setRepairDescription('');
        setVerificationCode('');
        setModalError('');
    };

    const handleReturnToProduction = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setModalError('');

        if (!selectedPallet) return;

        if (!washConfirm && !fluxConfirm) {
            setModalError(t('maint_modal_error_confirm_tasks'));
            return;
        }
        if (!repairDescription.trim()) {
            setModalError(t('maint_modal_error_description_required'));
            return;
        }

        try {
            const newStatus: PalletStatus = 'Active';
            const description = t('maint_service_audit_description', {
                description: repairDescription.trim(),
                washing: t(washConfirm ? 'answer_yes' : 'answer_no'),
                inspection: t(fluxConfirm ? 'answer_yes' : 'answer_no'),
            });

            const response = await authenticatedFetch(`${API_BASE_URL}/pallets/change-status`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language,
                },
                body: JSON.stringify({
                    pallet_id: selectedPallet.pallet_id,
                    new_status: newStatus,
                    block_reason: description,
                    reset_cycles: true,
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                setModalError(errData.message);
                return;
            }

            await fetchPallets();
            setSelectedPallet(null);
        } catch (error: unknown) {
            console.error('Error returning pallet to production:', error);
            setModalError(t('error_connecting_to_encore'));
        }
    };

    return {
        data: {
            activeTab,
            selectedPallet,
            washConfirm,
            fluxConfirm,
            repairDescription,
            Operator,
            verificationCode,
            modalError,
            repairPallets,
            routinePallets,
            filteredRepairPallets,
            filteredRoutinePallets,
            searchTerm
        },
        actions: {
            setActiveTab,
            setSelectedPallet,
            setWashConfirm,
            setFluxConfirm,
            setRepairDescription,
            setVerificationCode,
            handleOpenServiceLog,
            handleReturnToProduction,
            setSearchTerm
        },
    };
}
