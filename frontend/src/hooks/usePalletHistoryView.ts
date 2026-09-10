import { useToast } from '../components/ToastProvider';
import { useEffect, useMemo, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { AuditLog, Pallet } from '@backend/shared/types';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { useAuth } from '../auth/AuthContext.tsx';
import { getFisUnitHistoryUrl } from '../config/fis.ts';

import { asPallet } from '../lib/api.ts';

import { escapeCsvCell } from '../lib/csv.ts';
import { getErrorMessage } from '../lib/errors.ts';
export type SortOrder = 'newest' | 'oldest';
export type EventType = 'all' | 'status' | 'update';

function timestampValue(timestamp: string): number {
    const value = new Date(timestamp).getTime();
    return Number.isNaN(value) ? 0 : value;
}

export function usePalletHistoryView() {
    const {palletId = ''} = useParams();
    const navigate = useNavigate();
    const {t, language} = useTranslation();
    const {apiClient} = useAuth();
    const [pallet, setPallet] = useState<Pallet | null>(null);
    const [history, setHistory] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [eventType, setEventType] = useState<EventType>('all');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [operator, setOperator] = useState('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const notify = useToast();
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        const fetchPalletHistory = async () => {
            setIsLoading(true);
            setError('');
            setHistory([]);
            try {
                const requestApi = apiClient.with({
                    fetcher: (input, init) => fetch(input, {...init, signal: controller.signal}),
                });
                const palletResponse = await requestApi.pallet.GetPallet(palletId, {acceptLanguage: language});
                const palletData = asPallet(palletResponse.pallet);
                const fullHistory: AuditLog[] = [];
                let beforeId: number | undefined;
                do {
                    const pageData = await requestApi.pallet.GetPalletHistory(palletId, {
                        history_limit: 200,
                        history_before_id: beforeId,
                        acceptLanguage: language,
                    });
                    fullHistory.push(...(pageData.history as AuditLog[]));
                    beforeId = pageData.next_cursor;
                } while (beforeId !== undefined);
                if (!controller.signal.aborted) {
                    setPallet(palletData);
                    setHistory(fullHistory);
                }
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                console.error('Failed to fetch pallet history:', fetchError);
                setError(getErrorMessage(fetchError, t('history_load_error')));
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        void fetchPalletHistory();
        return () => controller.abort();
    }, [apiClient, language, palletId, t]);

    const localizedStatusLabels = useMemo<Record<string, string>>(() => ({
        Active: t('status_active'),
        Damaged: t('status_damaged'),
        Washing_Required: t('status_washing_required'),
        Blocked: t('status_blocked'),
    }), [t]);

    const operators = useMemo(() => Array.from(new Set(
        history.map((entry) => entry.operator_id).filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, language)), [history, language]);

    const filteredHistory = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase(language);
        return history
            .filter((entry) => {
                const isStatusChange = entry.previous_status !== entry.new_status;
                const matchesType = eventType === 'all' ||
                    (eventType === 'status' && isStatusChange) ||
                    (eventType === 'update' && !isStatusChange);
                const matchesStatus = statusFilter === 'ALL' ||
                    entry.previous_status === statusFilter || entry.new_status === statusFilter;
                const matchesOperator = operator === 'ALL' || entry.operator_id === operator;
                const searchableText = [
                    entry.id,
                    entry.operator_id,
                    entry.description,
                    entry.previous_status,
                    entry.new_status,
                    localizedStatusLabels[entry.previous_status],
                    localizedStatusLabels[entry.new_status],
                    new Date(entry.timestamp).toLocaleString(language),
                ].join(' ').toLocaleLowerCase(language);
                return matchesType && matchesStatus && matchesOperator &&
                    (!normalizedQuery || searchableText.includes(normalizedQuery));
            })
            .sort((a, b) => sortOrder === 'newest'
                ? timestampValue(b.timestamp) - timestampValue(a.timestamp)
                : timestampValue(a.timestamp) - timestampValue(b.timestamp));
    }, [eventType, history, language, localizedStatusLabels, operator, query, sortOrder, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const visibleHistory = filteredHistory.slice((safePage - 1) * pageSize, safePage * pageSize);
    const fisHistoryUrl = pallet ? getFisUnitHistoryUrl(Number(pallet.fis), pallet.pallet_id) : null;
    const hasFilters = Boolean(query || eventType !== 'all' || statusFilter !== 'ALL' || operator !== 'ALL');

    const clearFilters = () => {
        setQuery('');
        setEventType('all');
        setStatusFilter('ALL');
        setOperator('ALL');
        setPage(1);
    };

    const handleCopyPalletId = async () => {
        if (!pallet) return;
        try {
            await navigator.clipboard.writeText(pallet.pallet_id);
            setIsCopied(true);
            notify(language === 'pl' ? 'Skopiowano ID palety.' : 'Pallet ID copied.');
            setTimeout(() => setIsCopied(false), 2000);
        } catch {
            // fallback
            const input = document.createElement('input');
            input.value = pallet.pallet_id;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setIsCopied(true);
            notify(language === 'pl' ? 'Skopiowano ID palety.' : 'Pallet ID copied.');
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    const handleExportCSV = () => {
        if (!pallet || filteredHistory.length === 0) return;

        const headers = [
            'ID Wpisu',
            'Data i Czas',
            'ID Palety',
            'Projekt',
            'Model',
            'Poprzedni Status',
            'Nowy Status',
            'Operator',
            'Opis / Powód'
        ];

        const rows = filteredHistory.map(entry => [
            escapeCsvCell(entry.id),
            escapeCsvCell(new Date(entry.timestamp).toISOString()),
            escapeCsvCell(entry.pallet_id || pallet.pallet_id),
            escapeCsvCell(pallet.project),
            escapeCsvCell(pallet.model),
            escapeCsvCell(entry.previous_status),
            escapeCsvCell(entry.new_status),
            escapeCsvCell(entry.operator_id),
            escapeCsvCell(entry.description)
        ].join(';'));

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
        const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Historia_Palety_${pallet.pallet_id}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return {
        palletId,
        navigate,
        t,
        language,
        pallet,
        history,
        isLoading,
        error,
        query,
        setQuery,
        sortOrder,
        setSortOrder,
        eventType,
        setEventType,
        statusFilter,
        setStatusFilter,
        operator,
        setOperator,
        setPage,
        pageSize,
        setPageSize,
        isCopied,
        localizedStatusLabels,
        operators,
        filteredHistory,
        totalPages,
        safePage,
        visibleHistory,
        fisHistoryUrl,
        hasFilters,
        clearFilters,
        handleCopyPalletId,
        handleExportCSV,
    };
}
