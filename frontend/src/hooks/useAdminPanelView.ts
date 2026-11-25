import { ADMIN_COLUMNS_STORAGE_KEY, readHiddenColumns, savePreference, type OptionalColumn, type SortKey } from '../lib/tablePreferences';
import { postBroadcastMessage, subscribeBroadcast } from '../lib/broadcastSync';
import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n/LanguageContext.tsx';
import { Pallet } from '@backend/shared/types';
import { useAdminPanel } from '../hooks/useAdminPanel.ts';

import { useNavigate, useSearchParams } from "react-router";

export function useAdminPanelView(_props: Parameters<typeof useAdminPanel>[0], panel: ReturnType<typeof useAdminPanel>) {
    const {data, actions} = panel;
    const {t, language} = useTranslation();
    const [selectedById, setSelectedById] = useState<Record<string, Pallet>>({});
    const [hiddenColumns, setHiddenColumns] = useState(readHiddenColumns);
    useEffect(() => {
        return subscribeBroadcast((message) => {
            if (message.type === 'table:preferences' && message.hiddenColumns) {
                setHiddenColumns(message.hiddenColumns);
            }
        });
    }, []);
    const selectedIds = Object.keys(selectedById);
    const setSelectedIds = (updater: string[] | ((current: string[]) => string[])) => {
        setSelectedById(current => {
            const nextIds = typeof updater === 'function' ? updater(Object.keys(current)) : updater;
            const next: Record<string, Pallet> = {};
            for (const id of nextIds) {
                const match = data.paginatedPallets.find(p => p.pallet_id === id) ?? current[id];
                if (match) next[id] = match;
            }
            return next;
        });
    };
    const selectedPallets = Object.values(selectedById);
    const toggleSelected = (id: string) => {
        setSelectedById(current => {
            if (current[id]) {
                const rest = {...current};
                delete rest[id];
                return rest;
            }
            const match = data.paginatedPallets.find(p => p.pallet_id === id);
            return match ? {...current, [id]: match} : current;
        });
    };
    const pageIds = data.paginatedPallets.map(p => p.pallet_id);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => Boolean(selectedById[id]));
    const togglePage = () => {
        setSelectedById(current => {
            if (allPageSelected) {
                const next = {...current};
                for (const id of pageIds) delete next[id];
                return next;
            }
            const next = {...current};
            for (const pallet of data.paginatedPallets) next[pallet.pallet_id] = pallet;
            return next;
        });
    };
    const toggleColumn = (key: OptionalColumn) => {
        const next = hiddenColumns.includes(key) ? hiddenColumns.filter(value => value !== key) : [...hiddenColumns, key];
        setHiddenColumns(next);
        savePreference(ADMIN_COLUMNS_STORAGE_KEY, next);
        postBroadcastMessage({type: 'table:preferences', hiddenColumns: next});
    };
    const sortBy = (key: SortKey) => actions.setSort({key, direction: data.sort.key === key ? (data.sort.direction === 'asc' ? 'desc' : 'asc') : (key === 'created_at' ? 'desc' : 'asc')});
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedProjectFromUrl = searchParams.get('project') || 'ALL';
    const selectedModelFromUrl = searchParams.get('model') || 'ALL';
    const selectedStatusFromUrl = searchParams.get('status') || 'ALL';
    const fisFromUrl = searchParams.get('fis');
    const selectedFisFromUrl = fisFromUrl === '1' || fisFromUrl === '2' ? fisFromUrl : 'ALL';
    const machineFromUrl = searchParams.get('machine');
    const selectedMachineFromUrl = machineFromUrl && ['WSM', 'SSM', 'COAT'].includes(machineFromUrl) ? machineFromUrl : 'ALL';
    const searchTermFromURL = searchParams.get('searchTerm') || '';
    const {
        setSearchTerm,
        setSelectedModel,
        setSelectedProject,
        setSelectedStatus,
        setSelectedMachine,
        setSelectedFis,
    } = actions;
    const hasActiveFilters = selectedProjectFromUrl !== 'ALL' || selectedModelFromUrl !== 'ALL' ||
        selectedStatusFromUrl !== 'ALL' || selectedMachineFromUrl !== 'ALL' || selectedFisFromUrl !== 'ALL' || Boolean(searchTermFromURL);
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

    useEffect(() => {setSelectedMachine(selectedMachineFromUrl);}, [selectedMachineFromUrl, setSelectedMachine]);

    useEffect(() => {setSelectedFis(selectedFisFromUrl);}, [selectedFisFromUrl, setSelectedFis]);

    const clearFilters = () => {
        const nextParams = new URLSearchParams(searchParams);
        ['project', 'model', 'status', 'machine', 'fis', 'searchTerm'].forEach((key) => nextParams.delete(key));
        setSearchParams(nextParams);
        actions.setSelectedProject('ALL');
        actions.setSelectedModel('ALL');
        actions.setSelectedStatus('ALL');
        actions.setSelectedMachine('ALL');
        actions.setSelectedFis('ALL');
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
        selectedMachineFromUrl,
        selectedFisFromUrl,
        setSelectedModel,
        setSelectedProject,
        setSelectedStatus,
        setSelectedMachine,
        setSelectedFis,
        hasActiveFilters,
        cycleStepEvery,
        cycleStepAmount,
        isAddPalletValid,
        openPalletHistory,
        clearFilters,
    };
}
