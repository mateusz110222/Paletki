
import { readHiddenColumns, savePreference, type OptionalColumn, type SortKey } from '../lib/tablePreferences';
import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n/LanguageContext.tsx';
import { Pallet } from '@backend/shared/types';
import { useAdminPanel } from '../hooks/useAdminPanel.ts';

import { useNavigate, useSearchParams } from "react-router-dom";

export function useAdminPanelView(props: Parameters<typeof useAdminPanel>[0], panel: ReturnType<typeof useAdminPanel>) {
    const {data, actions} = panel;
    const {t, language} = useTranslation();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [hiddenColumns, setHiddenColumns] = useState(readHiddenColumns);
    const selectedPallets = props.pallets.filter(p => selectedIds.includes(p.pallet_id));
    const toggleSelected = (id: string) => setSelectedIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
    const pageIds = data.paginatedPallets.map(p => p.pallet_id);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
    const togglePage = () => setSelectedIds(ids => allPageSelected ? ids.filter(id => !pageIds.includes(id)) : [...new Set([...ids, ...pageIds])]);
    const toggleColumn = (key: OptionalColumn) => {
        const next = hiddenColumns.includes(key) ? hiddenColumns.filter(value => value !== key) : [...hiddenColumns, key];
        setHiddenColumns(next); savePreference('palletx.admin.columns', next);
    };
    const sortBy = (key: SortKey) => actions.setSort({key, direction: data.sort.key === key ? (data.sort.direction === 'asc' ? 'desc' : 'asc') : (key === 'created_at' ? 'desc' : 'asc')});
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedProjectFromUrl = searchParams.get('project') || 'ALL';
    const selectedModelFromUrl = searchParams.get('model') || 'ALL';
    const selectedStatusFromUrl = searchParams.get('status') || 'ALL';
    const searchTermFromURL = searchParams.get('searchTerm') || '';
    const {
        setSearchTerm,
        setSelectedModel,
        setSelectedProject,
        setSelectedStatus,
    } = actions;
    const hasActiveFilters = selectedProjectFromUrl !== 'ALL' || selectedModelFromUrl !== 'ALL' ||
        selectedStatusFromUrl !== 'ALL' || Boolean(searchTermFromURL);
    const cycleStepEvery = Number(data.cycleStepEvery);
    const cycleStepAmount = Number(data.cycleStepAmount);
    const rangeCycleStepValid = data.addMode !== 'range' || !data.cycleSteppingEnabled || Boolean(
        Number.isSafeInteger(cycleStepEvery) && cycleStepEvery > 0 &&
        Number.isSafeInteger(cycleStepAmount) && cycleStepAmount > 0 &&
        data.rangeCyclePreview && data.rangeCyclePreview.lastLimit > 0 && data.rangeCyclePreview.lastLimit <= 1_000_000,
    );
    const isAddPalletValid = Boolean(
        data.newId.trim() &&
        (data.addMode === 'single' || data.newLastId.trim()) &&
        data.newProject &&
        data.newModel &&
        Number(data.newMaxCycles) > 0 &&
        Number(data.newNests) > 0 &&
        data.newFis &&
        rangeCycleStepValid,
    );
    const openPalletHistory = (pallet: Pallet) => {
        navigate(`/admin/pallets/${encodeURIComponent(pallet.pallet_id)}/history`);
    };

    const clearFilters = () => {
        const nextParams = new URLSearchParams(searchParams);
        ['project', 'model', 'status', 'searchTerm'].forEach((key) => nextParams.delete(key));
        setSearchParams(nextParams);
        actions.setSelectedProject('ALL');
        actions.setSelectedModel('ALL');
        actions.setSelectedStatus('ALL');
        actions.setSearchTerm('');
    };

    useEffect(() => {
        setSelectedProject(selectedProjectFromUrl);
    }, [selectedProjectFromUrl, setSelectedProject]);

    useEffect(() => {
        setSelectedModel(selectedModelFromUrl);
    }, [selectedModelFromUrl, setSelectedModel]);

    useEffect(() => {
        setSelectedStatus(selectedStatusFromUrl);
    }, [selectedStatusFromUrl, setSelectedStatus]);

    useEffect(() => {
        setSearchTerm(searchTermFromURL);
    }, [searchTermFromURL, setSearchTerm]);

    return {
        t,
        language,
        selectedIds,
        setSelectedIds,
        hiddenColumns,
        selectedPallets,
        toggleSelected,
        pageIds,
        allPageSelected,
        togglePage,
        toggleColumn,
        sortBy,
        searchParams,
        setSearchParams,
        selectedProjectFromUrl,
        selectedModelFromUrl,
        selectedStatusFromUrl,
        searchTermFromURL,
        setSearchTerm,
        setSelectedModel,
        setSelectedProject,
        setSelectedStatus,
        hasActiveFilters,
        cycleStepEvery,
        cycleStepAmount,
        isAddPalletValid,
        openPalletHistory,
        clearFilters,
    };
}
