import { useEffect, useRef, useState } from 'react';
import { Pallet, PalletStatus } from '@backend/shared/types';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { useAuth } from "../auth/AuthContext.tsx";
import {useGlobalErrorModal} from "../hooks/useGlobalErrorModal.ts";
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";

interface UseOperatorPanelProps {
    pallets: Pallet[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
}

export const useOperatorPanel = ({ pallets, setPallets }: UseOperatorPanelProps) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const {errorModalState, showGlobalError, hideGlobalError} = useGlobalErrorModal();

    const [scannedId, setScannedId] = useState('');
    const [activePallet, setActivePallet] = useState<Pallet | null>(null);
    const [scanStatus, setScanStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

    const [isOtherFaultOpen, setIsOtherFaultOpen] = useState(false);
    const [customFaultText, setCustomFaultText] = useState('');

    const [isToastOpen, setIsToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }

        const handleBodyClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const interactiveTags = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'];
            if (!interactiveTags.includes(target.tagName) && barcodeInputRef.current) {
                barcodeInputRef.current.focus();
            }
        };

        document.body.addEventListener('click', handleBodyClick);
        return () => {
            document.body.removeEventListener('click', handleBodyClick);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const triggerToast = (msg: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMsg(msg);
        setIsToastOpen(true);
        toastTimerRef.current = setTimeout(() => {
            setIsToastOpen(false);
        }, 4000);
    };

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const palletUpper = scannedId.trim().toUpperCase();
        if (!palletUpper) return;

        try {
            const response = await fetch(`${API_BASE_URL}/pallets/${palletUpper}`);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `${t('error_connecting_to_encore')}: ${palletUpper}`);
            }

            const pallet: Pallet = await response.json();

            setActivePallet(pallet);
            setScanStatus('SUCCESS');
            triggerToast(`${t('op_scan_success') || 'Zeskanowano pomyślnie'}: ${pallet.pallet_id}`);

            setTimeout(() => setScanStatus('IDLE'), 1000);
        } catch (error: any) {
            console.error('Błąd skanowania:', error);
            setScanStatus('ERROR');
            setActivePallet(null);
            triggerToast(error.message || `${t('op_scan_error') || 'Błąd: Brak palety w bazie danych!'}`);

            setTimeout(() => setScanStatus('IDLE'), 1500);
        } finally {
            setScannedId('');
        }
    };

    const handleReportFault = async (faultName: string, newStatus: PalletStatus) => {
        if (!activePallet) {
            triggerToast(t('op_no_pallet_scanned') || 'Błąd: Najpierw zeskanuj paletę!');
            return;
        }

        setIsSubmitting(true);
        const description = `Zgłoszono usterkę (Skaner): ${faultName}`;

        try {
            const response = await fetch(`${API_BASE_URL}/pallets/change-status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pallet_id: activePallet.pallet_id,
                    new_status: newStatus,
                    operator_id: user?.FullName || 'Unknown Operator',
                    block_reason: description,
                    reset_cycles: true,
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || t('error_connecting_to_encore'));
            }

            triggerToast(`${t('op_fault_reported') || 'Zgłoszono usterkę'}: ${faultName}.`);

            try {
                const res = await fetch(`${API_BASE_URL}/pallets`);
                if (res.ok) {
                    const data = await res.json();
                    setPallets(data.pallets || []);
                } else {
                    const errData = await res.json();
                    showGlobalError(t('error_fetching_pallets_title'), errData.message || t('error_connecting_to_encore'));
                }
            } catch (error: any) {
                console.error("Failed to fetch pallets:", error);
                showGlobalError(t('error_fetching_pallets_title'), error.message || t('error_connecting_to_encore'));
            }

            setActivePallet(null);
            setIsOtherFaultOpen(false);
            setCustomFaultText('');
        } catch (error: any) {
            console.error('Błąd zgłaszania usterki:', error);
            triggerToast(error.message || t('error_connecting_to_encore'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClearActivePallet = () => {
        setActivePallet(null);
        setScannedId('');
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    };

    return {
        data: {
            scannedId,
            activePallet,
            scanStatus,
            isOtherFaultOpen,
            customFaultText,
            isToastOpen,
            toastMsg,
            isSubmitting,
            pallets,
            errorModalState
        },
        actions: {
            setScannedId,
            setActivePallet,
            setScanStatus,
            setIsOtherFaultOpen,
            setCustomFaultText,
            setIsToastOpen,
            setToastMsg,
            handleScanSubmit,
            handleReportFault,
            handleClearActivePallet,
            barcodeInputRef,
            hideGlobalError
        },
    };
};