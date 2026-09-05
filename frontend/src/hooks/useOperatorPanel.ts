import {useToast} from '../components/ToastProvider';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pallet, PalletStatus} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useGlobalErrorModal} from "../hooks/useGlobalErrorModal.ts";
import {useSearchParams} from "react-router-dom";
import {useAuth} from "../auth/AuthContext.tsx";
import {asPallet} from "../lib/api.ts";
import {useQueryClient} from '@tanstack/react-query';
import {
    initAudioUnlock,
    prepareScanAudio,
    playScanErrorSound,
    playScanSuccessSound,
    playScanWarningSound,
    getAudioVolumeLevel,
    setAudioVolumeLevel,
    addSoundListener,
    AudioVolumeLevel,
    SoundToneType
} from '../lib/audio.ts';
import {getErrorMessage} from '../lib/errors.ts';
import {canOpenPalletInOperatorPanel} from '@backend/shared/permissions';

export type ScanFeedbackTone = 'success' | 'warning' | 'error';

export const useOperatorPanel = () => {
    const {t, language} = useTranslation();
    const {apiClient} = useAuth();
    const queryClient = useQueryClient();
    const {errorModalState, hideGlobalError} = useGlobalErrorModal();

    const [scannedId, setScannedId] = useState('');
    const [lastScannedId, setLastScannedId] = useState('');
    const [activePallet, setActivePallet] = useState<Pallet | null>(null);
    const [scanStatus, setScanStatus] = useState<'IDLE' | 'SUCCESS' | 'WARNING' | 'ERROR'>('IDLE');

    const [isOtherFaultOpen, setIsOtherFaultOpen] = useState(false);
    const [customFaultText, setCustomFaultText] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // Network connectivity status (Online / Offline)
    const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Visual soundwave ripple state triggered whenever a sound is played
    const [audioRipple, setAudioRipple] = useState<SoundToneType | null>(null);

    useEffect(() => {
        let timer: number;
        const unsubscribe = addSoundListener((tone) => {
            setAudioRipple(tone);
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                setAudioRipple(null);
            }, 600);
        });

        return () => {
            unsubscribe();
            window.clearTimeout(timer);
        };
    }, []);

    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const scanAbortRef = useRef<AbortController | null>(null);
    const scanRequestRef = useRef(0);

    const [searchParams, setSearchParams] = useSearchParams();
    const palletIDFromUrl = searchParams.get('palletID') || '';

    // Initialize audio unlock listeners on mount so scanner input or clicks wake AudioContext
    useEffect(() => {
        initAudioUnlock();
    }, []);

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
        scanAbortRef.current?.abort();
    }, []);

    const processedUrlIdRef = useRef<string | null>(null);

    const triggerToast = useToast();
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try {
            const saved = localStorage.getItem('palletx.scan-sound');
            return saved === null ? true : saved !== 'false';
        } catch {
            return true;
        }
    });

    const soundEnabledRef = useRef(soundEnabled);

    const [volumeLevel, setVolumeLevel] = useState<AudioVolumeLevel>(() => getAudioVolumeLevel());

    const updateVolumeLevel = (level: AudioVolumeLevel) => {
        setVolumeLevel(level);
        setAudioVolumeLevel(level);
        if (soundEnabled) {
            prepareScanAudio();
            void playScanSuccessSound();
        }
    };

    const cycleVolumeLevel = () => {
        const order: AudioVolumeLevel[] = ['normal', 'loud', 'low'];
        const nextIdx = (order.indexOf(volumeLevel) + 1) % order.length;
        updateVolumeLevel(order[nextIdx]);
    };

    const [scanFeedback, setScanFeedback] = useState<{tone: ScanFeedbackTone; message: string} | null>(null);
    const toggleSound = () => {
        const next = !soundEnabled;
        soundEnabledRef.current = next;
        setSoundEnabled(next);
        try {
            localStorage.setItem('palletx.scan-sound', String(next));
        } catch {
            // Optional preference.
        }
        if (next) {
            prepareScanAudio();
            void playScanSuccessSound();
        }
    };

    const handleScanSubmit = useCallback(async (e?: React.SyntheticEvent<HTMLFormElement>, idToScan?: string) => {
        if (e) e.preventDefault();

        const palletUpper = (idToScan !== undefined ? idToScan : scannedId).trim().toUpperCase();

        if (!palletUpper) return;

        scanAbortRef.current?.abort();
        const controller = new AbortController();
        scanAbortRef.current = controller;
        const requestId = ++scanRequestRef.current;
        setIsScanning(true);
        setScanStatus('IDLE');
        setScanFeedback(null);
        if (soundEnabled) prepareScanAudio();

        try {
            const scanApi = apiClient.with({
                fetcher: (input, init) => fetch(input, {...init, signal: controller.signal}),
            });
            const response = await scanApi.pallet.GetPallet(palletUpper, {acceptLanguage: language});
            const pallet = asPallet(response.pallet);
            if (requestId !== scanRequestRef.current) return;

            if (!canOpenPalletInOperatorPanel(pallet.status)) {
                if (soundEnabledRef.current) void playScanErrorSound();
                setActivePallet(null);
                setScanStatus('ERROR');
                setScanFeedback({tone: 'error', message: `${palletUpper}: ${t('op_blocked_pallet_unavailable')}`});
                return;
            }

            const isExceededCycles = pallet.max_cycles > 0 && pallet.current_cycles >= pallet.max_cycles;
            const isDamaged = pallet.status === 'Damaged';
            const isWashing = pallet.status === 'Washing_Required';
            const isWarningCondition = isDamaged || isWashing || isExceededCycles;

            if (isWarningCondition) {
                if (soundEnabledRef.current) void playScanWarningSound();
                setScanStatus('WARNING');
                let warningMsg = t('op_scan_warning_damaged');
                if (isWashing) {
                    warningMsg = t('op_scan_warning_washing');
                } else if (isExceededCycles) {
                    warningMsg = t('op_scan_warning_cycles');
                }
                setScanFeedback({tone: 'warning', message: `${pallet.pallet_id}: ${warningMsg}`});
            } else {
                if (soundEnabledRef.current) void playScanSuccessSound();
                setScanStatus('SUCCESS');
                setScanFeedback({tone: 'success', message: t('op_scan_success_with_id', {palletId: pallet.pallet_id})});
            }

            setActivePallet(pallet);
            setLastScannedId(pallet.pallet_id);

            processedUrlIdRef.current = pallet.pallet_id;
            const newParams = new URLSearchParams(searchParams);
            newParams.set('palletID', pallet.pallet_id);
            setSearchParams(newParams);
        } catch (error: unknown) {
            if (controller.signal.aborted || requestId !== scanRequestRef.current) return;
            console.error('Błąd skanowania:', error);
            if (soundEnabledRef.current) void playScanErrorSound();
            setScanStatus('ERROR');
            setActivePallet(null);
            setScanFeedback({tone: 'error', message: `${palletUpper}: ${getErrorMessage(error, t('error_connecting_to_encore'))}`});
        } finally {
            if (requestId === scanRequestRef.current) {
                setIsScanning(false);
                requestAnimationFrame(() => barcodeInputRef.current?.focus());
            }
        }
    }, [apiClient, language, scannedId, searchParams, setSearchParams, soundEnabled, t]);

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
            triggerToast(getErrorMessage(error, t('error_connecting_to_encore')), 'error');
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
            lastScannedId,
            activePallet,
            scanStatus,
            scanFeedback,
            soundEnabled,
            volumeLevel,
            audioRipple,
            isOnline,
            isOtherFaultOpen,
            customFaultText,
            isSubmitting,
            isScanning,
            errorModalState,
        },
        actions: {
            toggleSound,
            setVolumeLevel: updateVolumeLevel,
            cycleVolumeLevel,
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
