import {getPalletScanTone} from '../lib/scannerFeedback';
import {useToast} from '../components/ToastProvider';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pallet, PalletStatus} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useGlobalErrorModal} from "../hooks/useGlobalErrorModal.ts";
import {useSearchParams} from "react-router";
import {useAuth} from "../auth/AuthContext.tsx";
import {asPallet} from "../lib/api.ts";
import {postBroadcastMessage, SOUND_ENABLED_STORAGE_KEY, subscribeBroadcast} from '../lib/broadcastSync.ts';
import {refreshPalletData} from '../lib/queryCache.ts';
import {useQuery, useQueryClient} from '@tanstack/react-query';
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

    const defectsQuery = useQuery({queryKey: ['defects'], queryFn: () => apiClient.pallet.GetDefects(), staleTime: 0});
    const [selectedDefect, setSelectedDefect] = useState('');
    const [unavailablePallet, setUnavailablePallet] = useState<Pallet | null>(null);
    const [scannedId, setScannedId] = useState('');
    const [lastScannedId, setLastScannedId] = useState('');
    const [activePallet, setActivePallet] = useState<Pallet | null>(null);
    const [scanStatus, setScanStatus] = useState<'IDLE' | 'SUCCESS' | 'WARNING' | 'ERROR'>('IDLE');

    const [pendingFault, setPendingFault] = useState<{name: string; status: PalletStatus} | null>(null);
    const isOtherFaultOpen = pendingFault !== null;
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
    }, [activePallet, unavailablePallet, isOtherFaultOpen]);

    useEffect(() => () => {
        scanAbortRef.current?.abort();
    }, []);

    const processedUrlIdRef = useRef<string | null>(null);

    const triggerToast = useToast();
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try {
            const saved = localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
            return saved === null ? true : saved !== 'false';
        } catch {
            return true;
        }
    });

    const soundEnabledRef = useRef(soundEnabled);

    const [volumeLevel, setVolumeLevel] = useState<AudioVolumeLevel>(() => getAudioVolumeLevel());

    useEffect(() => {
        return subscribeBroadcast((message) => {
            if (message.type !== 'audio:preferences') return;
            if (typeof message.soundEnabled === 'boolean') {
                soundEnabledRef.current = message.soundEnabled;
                setSoundEnabled(message.soundEnabled);
            }
            if (message.volumeLevel) {
                setVolumeLevel(message.volumeLevel);
                setAudioVolumeLevel(message.volumeLevel);
            }
        });
    }, []);

    const updateVolumeLevel = (level: AudioVolumeLevel) => {
        setVolumeLevel(level);
        setAudioVolumeLevel(level);
        postBroadcastMessage({type: 'audio:preferences', volumeLevel: level});
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
            localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(next));
        } catch {
            // Optional preference.
        }
        postBroadcastMessage({type: 'audio:preferences', soundEnabled: next});
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
        setUnavailablePallet(null);
        setPendingFault(null);
        if (soundEnabled) prepareScanAudio();

        try {
            const scanApi = apiClient.with({
                fetcher: (input, init) => fetch(input, {...init, signal: controller.signal}),
            });
            const response = await scanApi.pallet.GetPallet(palletUpper, {acceptLanguage: language});
            const pallet = asPallet(response.pallet);
            if (requestId !== scanRequestRef.current) return;

            setLastScannedId(pallet.pallet_id);
            setScannedId('');

            processedUrlIdRef.current = pallet.pallet_id;
            const newParams = new URLSearchParams(searchParams);
            newParams.set('palletID', pallet.pallet_id);
            setSearchParams(newParams, {replace: true});

            if (!canOpenPalletInOperatorPanel(pallet.status)) {
                if (soundEnabledRef.current) void playScanErrorSound();
                setActivePallet(null);
                setUnavailablePallet(pallet);
                setScanStatus('ERROR');
                setScanFeedback({tone: 'error', message: `${palletUpper}: ${t(pallet.status === 'Damaged' ? 'op_scan_warning_damaged' : 'op_blocked_pallet_unavailable')}`});
                return;
            }

            const isExceededCycles = pallet.max_cycles > 0 && pallet.current_cycles >= pallet.max_cycles;
            const isWashing = pallet.status === 'Washing_Required';
            const tone = getPalletScanTone(pallet.status, isExceededCycles);

            if (tone === 'error') {
                if (soundEnabledRef.current) void playScanErrorSound();
                setScanStatus('ERROR');
                setScanFeedback({tone: 'error', message: `${pallet.pallet_id}: ${t('op_scan_warning_damaged')}`});
            } else if (tone === 'warning') {
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
        // Reset consumption only when the URL itself changes, not when a scan
        // clears the input while a router transition is still pending.
        if (!palletIDFromUrl.trim()) processedUrlIdRef.current = null;
    }, [palletIDFromUrl]);

    useEffect(() => {
        const upperUrlId = palletIDFromUrl.trim().toUpperCase();

        if (upperUrlId && processedUrlIdRef.current !== upperUrlId) {
            const scanTimer = window.setTimeout(() => {
                if (processedUrlIdRef.current === upperUrlId) return;
                processedUrlIdRef.current = upperUrlId;
                void handleScanSubmit(undefined, upperUrlId);
            }, 0);
            return () => window.clearTimeout(scanTimer);
        }
    }, [handleScanSubmit, palletIDFromUrl]);

    const openFaultModal = useCallback((name: string, status: PalletStatus, defect?: number | 'other') => {
        setCustomFaultText('');
        setPendingFault({name, status});
        setSelectedDefect(status === 'Damaged' ? defect === undefined ? '' : String(defect) : 'washing');
    }, []);

    const closeFaultModal = useCallback(() => {
        if (!isSubmitting) setPendingFault(null);
    }, [isSubmitting]);

    const handleReportFault = useCallback(async () => {
        if (!pendingFault || isSubmitting || (pendingFault.status === 'Damaged' && !selectedDefect) || (selectedDefect === 'other' && !customFaultText.trim())) return;
        if (!activePallet) {
            triggerToast(t('op_no_pallet_scanned'));
            return;
        }

        setIsSubmitting(true);
        const name = pendingFault.status === 'Washing_Required' ? pendingFault.name : defectsQuery.data?.defects.find(d => String(d.id) === selectedDefect)?.name ?? t('op_other_fault_type');
        const faultName = `${name}${customFaultText.trim() ? ': ' + customFaultText.trim() : ''}`;

        try {
            await apiClient.pallet.CreateOperatorReport({
                pallet_id: activePallet.pallet_id,
                kind: pendingFault.status === 'Washing_Required' ? 'washing' : 'defect',
                defect_id: pendingFault.status === 'Washing_Required' || selectedDefect === 'other' ? null : Number(selectedDefect),
                description: customFaultText.trim(), acceptLanguage: language,
            });

            triggerToast(t('op_fault_reported_with_name', {faultName}));

            await refreshPalletData(queryClient);

            setActivePallet(null);
            setPendingFault(null);
            setCustomFaultText('');
            setScannedId('');
        } catch (error: unknown) {
            console.error('Błąd zgłaszania usterki:', error);
            triggerToast(getErrorMessage(error, t('error_connecting_to_encore')), 'error');
        } finally {
            setIsSubmitting(false);
        }
    }, [activePallet, apiClient, language, queryClient, t, triggerToast, pendingFault, customFaultText, selectedDefect, defectsQuery.data, isSubmitting]);

    const handleClearActivePallet = useCallback(() => {
        scanAbortRef.current?.abort();
        ++scanRequestRef.current;
        setIsScanning(false);
        setActivePallet(null);
        setUnavailablePallet(null);
        setScanFeedback(null);
        setScanStatus('IDLE');
        setScannedId('');
        // Router navigation can commit after the local reset. Keep the old URL
        // consumed until the effect observes its removal, avoiding a second scan.
        processedUrlIdRef.current = searchParams.get('palletID')?.trim().toUpperCase() || null;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('palletID');
        setSearchParams(nextParams, {replace: true});
        requestAnimationFrame(() => barcodeInputRef.current?.focus());
    }, [searchParams, setSearchParams]);

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
                openFaultModal(t('op_mechanical_damage'), 'Damaged');
            } else if (e.key === '2') {
                e.preventDefault();
                openFaultModal(t('op_washing_required'), 'Washing_Required');
            } else if (e.key === '3') {
                e.preventDefault();
                openFaultModal(t('op_other_fault_type'), 'Damaged', 'other');
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleClearActivePallet();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activePallet, handleClearActivePallet, openFaultModal, isOtherFaultOpen, isSubmitting, t, defectsQuery.data]);

    return {
        data: {
            scannedId, unavailablePallet, selectedDefect, defects: defectsQuery.data?.defects ?? [], defectsLoading: defectsQuery.isPending, defectsError: defectsQuery.isError,
            lastScannedId,
            activePallet,
            scanStatus,
            scanFeedback,
            soundEnabled,
            volumeLevel,
            audioRipple,
            isOnline,
            isOtherFaultOpen,
            pendingFault,
            customFaultText,
            isSubmitting,
            isScanning,
            errorModalState,
        },
        actions: {
            toggleSound,
            setVolumeLevel: updateVolumeLevel,
            cycleVolumeLevel,
            setScannedId: (value: string) => setScannedId(value.toUpperCase()),
            openFaultModal, setSelectedDefect: (value: string) => {setSelectedDefect(value); if (value !== 'other') setCustomFaultText('');},
            closeFaultModal,
            setCustomFaultText,
            handleScanSubmit,
            handleReportFault,
            handleClearActivePallet,
            barcodeInputRef,
            hideGlobalError
        },
    };
};
