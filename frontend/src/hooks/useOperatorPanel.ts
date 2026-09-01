import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pallet, PalletStatus} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useGlobalErrorModal} from "../hooks/useGlobalErrorModal.ts";
import {useSearchParams} from "react-router-dom";
import {useAuth} from "../auth/AuthContext.tsx";
import {asPallet} from "../lib/api.ts";
import {useQueryClient} from '@tanstack/react-query';
import {playScanErrorSound, playScanSuccessSound} from '../lib/audio.ts';
import {getErrorMessage} from '../lib/errors.ts';
import {canOpenPalletInOperatorPanel} from '@backend/shared/permissions';

export const useOperatorPanel = () => {
    const {t, language} = useTranslation();
    const {apiClient} = useAuth();
    const queryClient = useQueryClient();
    const {errorModalState, hideGlobalError} = useGlobalErrorModal();

    const [scannedId, setScannedId] = useState('');
    const [activePallet, setActivePallet] = useState<Pallet | null>(null);
    const [scanStatus, setScanStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

    const [isOtherFaultOpen, setIsOtherFaultOpen] = useState(false);
    const [customFaultText, setCustomFaultText] = useState('');

    const [isToastOpen, setIsToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scanAbortRef = useRef<AbortController | null>(null);
    const scanRequestRef = useRef(0);

    const [searchParams, setSearchParams] = useSearchParams();
    const palletIDFromUrl = searchParams.get('palletID') || '';

    // Handle body click to keep barcode scanner focused without stealing focus from interactive elements
    useEffect(() => {
        if (barcodeInputRef.current && !activePallet && !isOtherFaultOpen) {
            barcodeInputRef.current.focus();
        }

        const handleBodyClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const interactive = target.closest('button, a, input, textarea, select, [role="button"], [tabindex]');
            if (!interactive && barcodeInputRef.current && !activePallet && !isOtherFaultOpen) {
                barcodeInputRef.current.focus();
            }
        };

        document.body.addEventListener('click', handleBodyClick);
        return () => document.body.removeEventListener('click', handleBodyClick);
    }, [activePallet, isOtherFaultOpen]);

    useEffect(() => () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        scanAbortRef.current?.abort();
    }, []);

    const processedUrlIdRef = useRef<string | null>(null);

    const triggerToast = useCallback((msg: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMsg(msg);
        setIsToastOpen(true);
        toastTimerRef.current = setTimeout(() => {
            setIsToastOpen(false);
            toastTimerRef.current = null;
        }, 4000);
    }, []);

    const handleScanSubmit = useCallback(async (e?: React.SyntheticEvent<HTMLFormElement>, idToScan?: string) => {
        if (e) e.preventDefault();

        const palletUpper = (idToScan !== undefined ? idToScan : scannedId).trim().toUpperCase();

        if (!palletUpper) return;

        scanAbortRef.current?.abort();
        const controller = new AbortController();
        scanAbortRef.current = controller;
        const requestId = ++scanRequestRef.current;
        setIsScanning(true);

        try {
            const scanApi = apiClient.with({
                fetcher: (input, init) => fetch(input, {...init, signal: controller.signal}),
            });
            const response = await scanApi.pallet.GetPallet(palletUpper, {acceptLanguage: language});
            const pallet = asPallet(response.pallet);
            if (requestId !== scanRequestRef.current) return;

            if (!canOpenPalletInOperatorPanel(pallet.status)) {
                playScanErrorSound();
                setActivePallet(null);
                setScanStatus('ERROR');
                triggerToast(t('op_blocked_pallet_unavailable'));
                setTimeout(() => setScanStatus('IDLE'), 1500);
                return;
            }

            playScanSuccessSound();
            setActivePallet(pallet);
            setScanStatus('SUCCESS');
            triggerToast(t('op_scan_success_with_id', {palletId: pallet.pallet_id}));

            const newParams = new URLSearchParams(searchParams);
            newParams.set('palletID', pallet.pallet_id);
            setSearchParams(newParams);
            setTimeout(() => setScanStatus('IDLE'), 1000);
        } catch (error: unknown) {
            if (controller.signal.aborted || requestId !== scanRequestRef.current) return;
            console.error('Błąd skanowania:', error);
            playScanErrorSound();
            setScanStatus('ERROR');
            setActivePallet(null);
            triggerToast(getErrorMessage(error, t('error_connecting_to_encore')));

            setTimeout(() => setScanStatus('IDLE'), 1500);
        } finally {
            if (requestId === scanRequestRef.current) setIsScanning(false);
        }
    }, [apiClient, language, scannedId, searchParams, setSearchParams, t, triggerToast]);

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

    const handleReportFault = useCallback(async (faultName: string, newStatus: PalletStatus) => {
        if (!activePallet) {
            triggerToast(t('op_no_pallet_scanned'));
            return;
        }

        setIsSubmitting(true);
        const description = t('op_fault_audit_description', {faultName});

        try {
            await apiClient.pallet.ChangePalletStatus({
                pallet_id: activePallet.pallet_id,
                new_status: newStatus,
                block_reason: description,
                reset_cycles: false,
                acceptLanguage: language,
            });

            triggerToast(t('op_fault_reported_with_name', {faultName}));

            await queryClient.invalidateQueries({queryKey: ['pallets']});

            setActivePallet(null);
            setIsOtherFaultOpen(false);
            setCustomFaultText('');
            setScannedId('');
        } catch (error: unknown) {
            console.error('Błąd zgłaszania usterki:', error);
            triggerToast(getErrorMessage(error, t('error_connecting_to_encore')));
        } finally {
            setIsSubmitting(false);
        }
    }, [activePallet, apiClient, language, queryClient, t, triggerToast]);

    const handleClearActivePallet = useCallback(() => {
        setActivePallet(null);
        setScannedId('');
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    }, []);

    // Operator Hotkeys: 1, 2, 3 to report quick faults when active pallet is open
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activePallet || isOtherFaultOpen || isSubmitting) return;

            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                return;
            }

            if (e.key === '1') {
                e.preventDefault();
                void handleReportFault(t('op_mechanical_damage'), 'Damaged');
            } else if (e.key === '2') {
                e.preventDefault();
                void handleReportFault(t('op_washing_required'), 'Washing_Required');
            } else if (e.key === '3') {
                e.preventDefault();
                void handleReportFault(t('op_pockets_error'), 'Damaged');
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleClearActivePallet();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activePallet, handleClearActivePallet, handleReportFault, isOtherFaultOpen, isSubmitting, t]);

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
            isScanning,
            errorModalState,
        },
        actions: {
            setScannedId,
            setIsOtherFaultOpen,
            setCustomFaultText,
            handleScanSubmit,
            handleReportFault,
            handleClearActivePallet,
            barcodeInputRef,
            hideGlobalError
        },
    };
};
