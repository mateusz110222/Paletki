import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pallet, PalletStatus} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useGlobalErrorModal} from "../hooks/useGlobalErrorModal.ts";
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";
import {useSearchParams} from "react-router-dom";
import {useAuth} from "../auth/AuthContext.tsx";

interface UseOperatorPanelProps {
    pallets: Pallet[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
}

export const useOperatorPanel = ({pallets, setPallets}: UseOperatorPanelProps) => {
    const {t, language} = useTranslation();
    const {authenticatedFetch} = useAuth();
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

    const [searchParams, setSearchParams] = useSearchParams();
    const palletIDFromUrl = searchParams.get('palletID') || '';

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

    const processedUrlIdRef = useRef<string | null>(null);

    const triggerToast = useCallback((msg: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMsg(msg);
        setIsToastOpen(true);
        toastTimerRef.current = setTimeout(() => {
            setIsToastOpen(false);
        }, 4000);
    }, []);

    const handleScanSubmit = useCallback(async (e?: React.SyntheticEvent<HTMLFormElement>, idToScan?: string) => {
        if (e) e.preventDefault();

        const palletUpper = (idToScan !== undefined ? idToScan : scannedId).trim().toUpperCase();

        if (!palletUpper) return;

        try {
            const response = await fetch(`${API_BASE_URL}/pallets/${encodeURIComponent(palletUpper)}`, {
                headers: {"Accept-Language": language},
            });

            if (!response.ok) {
                const errData = await response.json();
                setScanStatus('ERROR');
                setActivePallet(null);
                triggerToast(errData.message);
                setTimeout(() => setScanStatus('IDLE'), 1500);
                return;
            }

            const pallet: Pallet = await response.json();

            setActivePallet(pallet);
            setScanStatus('SUCCESS');
            triggerToast(t('op_scan_success_with_id', {palletId: pallet.pallet_id}));

            const newParams = new URLSearchParams(searchParams);
            newParams.set('palletID', pallet.pallet_id);
            setSearchParams(newParams);
            setTimeout(() => setScanStatus('IDLE'), 1000);
        } catch (error: unknown) {
            console.error('Błąd skanowania:', error);
            setScanStatus('ERROR');
            setActivePallet(null);
            triggerToast(t('error_connecting_to_encore'));

            setTimeout(() => setScanStatus('IDLE'), 1500);
        }
    }, [language, scannedId, searchParams, setSearchParams, t, triggerToast]);

    useEffect(() => {
        const upperUrlId = palletIDFromUrl.trim().toUpperCase();

        if (upperUrlId && processedUrlIdRef.current !== upperUrlId) {
            processedUrlIdRef.current = upperUrlId;
            const scanTimer = window.setTimeout(() => {
                setScannedId(upperUrlId);
                void handleScanSubmit(undefined, upperUrlId);
            }, 0);
            return () => window.clearTimeout(scanTimer);
        }
    }, [handleScanSubmit, palletIDFromUrl]);

    const handleReportFault = async (faultName: string, newStatus: PalletStatus) => {
        if (!activePallet) {
            triggerToast(t('op_no_pallet_scanned'));
            return;
        }

        setIsSubmitting(true);
        const description = t('op_fault_audit_description', {faultName});

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/pallets/change-status`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language,
                },
                body: JSON.stringify({
                    pallet_id: activePallet.pallet_id,
                    new_status: newStatus,
                    block_reason: description,
                    reset_cycles: false,
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                triggerToast(errData.message);
                return;
            }

            triggerToast(t('op_fault_reported_with_name', {faultName}));

            try {
                const res = await fetch(`${API_BASE_URL}/pallets`, {
                    headers: {"Accept-Language": language},
                });
                if (res.ok) {
                    const data = await res.json();
                    setPallets(data.pallets || []);
                } else {
                    const errData = await res.json();
                    showGlobalError(t('error_fetching_pallets_title'), errData.message);
                }
            } catch (error: unknown) {
                console.error("Failed to fetch pallets:", error);
                showGlobalError(t('error_fetching_pallets_title'), t('error_connecting_to_encore'));
            }

            setActivePallet(null);
            setIsOtherFaultOpen(false);
            setCustomFaultText('');
            setScannedId('');
        } catch (error: unknown) {
            console.error('Błąd zgłaszania usterki:', error);
            triggerToast(t('error_connecting_to_encore'));
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
            errorModalState,
            palletIDFromUrl
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
