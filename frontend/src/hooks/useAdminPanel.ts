import {matchesPalletSearch} from '../lib/palletSearch';
import {ADMIN_SORT_STORAGE_KEY, parseTableSort, readPreference, savePreference, sortPallets, type TableSort} from '../lib/tablePreferences';
import {postBroadcastMessage, subscribeBroadcast} from '../lib/broadcastSync';
import {refreshPalletData} from '../lib/queryCache';
import {useToast} from '../components/ToastProvider';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {getErrorMessage} from '../lib/errors';
import {Pallet, PalletModel, PalletStatus, PalletMachine, Project} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useGlobalErrorModal} from "./useGlobalErrorModal.ts";
import {useAuth} from "../auth/AuthContext.tsx";
import {useQueryClient} from '@tanstack/react-query';
interface UseAdminPanelProps {
    pallets: Pallet[];
    projects: Project[];
    models: PalletModel[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

type AddMode = 'single' | 'range';

const expandRange = (first: string, last: string): string[] | null => {
    const firstMatch = /^(.*?)(\d{2})$/.exec(first);
    const lastMatch = /^(.*?)(\d{2})$/.exec(last);
    if (!firstMatch || !lastMatch || !firstMatch[1] || firstMatch[1] !== lastMatch[1]) return null;
    const start = Number(firstMatch[2]);
    const end = Number(lastMatch[2]);
    if (start > end) return null;
    return Array.from({length: end - start + 1}, (_, index) =>
        `${firstMatch[1]}${String(start + index).padStart(2, '0')}`,
    );
};

export const useAdminPanel = ({
                                  pallets,
                                  projects,
                                  models,
                              }: UseAdminPanelProps) => {
    const notify = useToast();
    const {t, language} = useTranslation();
    const {apiClient} = useAuth();
    const queryClient = useQueryClient();
    const {errorModalState, showGlobalError, hideGlobalError} = useGlobalErrorModal();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProject, setSelectedProject] = useState('ALL');
    const [selectedModel, setSelectedModel] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [selectedMachine, setSelectedMachine] = useState('ALL');

    // Modals state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isBlockOpen, setIsBlockOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedPalletForBlock, setSelectedPalletForBlock] = useState<Pallet | null>(null);
    const [selectedPalletForEdit, setSelectedPalletForEdit] = useState<Pallet | null>(null);
    const [selectedPalletForUnblock, setSelectedPalletForUnblock] = useState<Pallet | null>(null);
    const [unblockComment, setUnblockComment] = useState('');
    const [unblockError, setUnblockError] = useState('');
    const unblockRunningRef = useRef(false);
    const [selectedPalletForDelete, setSelectedPalletForDelete] = useState<Pallet | null>(null);

    // Form inputs state
    const [blockReason, setBlockReason] = useState('');
    const [newId, setNewId] = useState('');
    const [newLastId, setNewLastId] = useState('');
    const [addMode, setAddMode] = useState<AddMode>('single');
    const [newModel, setNewModel] = useState('');
    const [newProject, setNewProject] = useState('');
    const [newMaxCycles, setNewMaxCycles] = useState('200');
    const [cycleSteppingEnabled, setCycleSteppingEnabled] = useState(false);
    const [cycleStepEvery, setCycleStepEvery] = useState('10');
    const [cycleStepAmount, setCycleStepAmount] = useState('10');
    const [newNests, setNewNests] = useState('1');
    const [newMachine, setNewMachine] = useState<PalletMachine | ''>('');
    const [newFis, setNewFis] = useState('1');

    // Edit Form inputs state
    const [editMachine, setEditMachine] = useState<PalletMachine>('WSM');
    const [editFis, setEditFis] = useState('1');
    const [editNests, setEditNests] = useState('1');
    const [editMaxCycles, setEditMaxCycles] = useState('200');
    const [editStatus, setEditStatus] = useState<PalletStatus>('Active');
    const [editBlockReason, setEditBlockReason] = useState('');
    const [editUnblockComment, setEditUnblockComment] = useState('');

    // Error & Status handling
    const [validationError, setValidationError] = useState('');
    const [blockError, setBlockError] = useState('');
    const [editError, setEditError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [sort, setSort] = useState(() => parseTableSort(readPreference(ADMIN_SORT_STORAGE_KEY)));
    useEffect(() => {
        return subscribeBroadcast((message) => {
            if (message.type === 'table:preferences' && message.sort) {
                setSort(prev => (prev.key === message.sort!.key && prev.direction === message.sort!.direction ? prev : message.sort!));
            }
        });
    }, []);
    const updateSort = (value: TableSort) => {
        setSort(value);
        savePreference(ADMIN_SORT_STORAGE_KEY, value);
        postBroadcastMessage({type: 'table:preferences', sort: value});
        setCurrentPage(1);
    };
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    const updateSearchTerm = useCallback((term: string) => {
        setSearchTerm(term);
        setCurrentPage(1);
    }, []);
    const updateSelectedProject = useCallback((project: string) => {
        setSelectedProject(project);
        setCurrentPage(1);
    }, []);
    const updateSelectedModel = useCallback((model: string) => {
        setSelectedModel(model);
        setCurrentPage(1);
    }, []);
    const updateSelectedStatus = useCallback((status: string) => {
        setSelectedStatus(status);
        setCurrentPage(1);
    }, []);
    const updateSelectedMachine = useCallback((machine: string) => {
        setSelectedMachine(machine);
        setCurrentPage(1);
    }, []);
    const updatePageSize = useCallback((size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    }, []);

    const filteredPallets = useMemo(() => (pallets || []).filter((p) => {
        const project = p.project || '';

        const matchesSearch = matchesPalletSearch(p, searchTerm);
        const matchesProject = selectedProject === 'ALL' || project === selectedProject;
        const matchesModel = selectedModel === 'ALL' || p.model === selectedModel;
        const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;

        return matchesSearch && matchesProject && matchesModel && matchesStatus && (selectedMachine === 'ALL' || p.machine === selectedMachine);
    }), [pallets, searchTerm, selectedModel, selectedProject, selectedStatus, selectedMachine]);

    const sortedPallets = useMemo(() => sortPallets(filteredPallets, sort, language), [filteredPallets, sort, language]);
    const totalPages = Math.max(1, Math.ceil(filteredPallets.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedPallets = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return sortedPallets.slice(start, start + pageSize);
    }, [sortedPallets, safeCurrentPage, pageSize]);

    const availableModels = useMemo(() => {
        const relevantModels = selectedProject === 'ALL'
            ? models
            : models.filter((model) => model.project === selectedProject);
        return Array.from(new Set(relevantModels.map((model) => model.name).filter(Boolean))).sort((a, b) =>
            a.localeCompare(b),
        );
    }, [models, selectedProject]);

    const newPalletModels = useMemo(() => models
        .filter((model) => model.project === newProject)
        .map((model) => model.name)
        .sort((left, right) => left.localeCompare(right)), [models, newProject]);

    const rangeCyclePreview = useMemo(() => {
        if (addMode !== 'range' || !cycleSteppingEnabled) return null;
        const ids = expandRange(newId.trim().toUpperCase(), newLastId.trim().toUpperCase());
        const base = Number(newMaxCycles);
        const every = Number(cycleStepEvery);
        const amount = Number(cycleStepAmount);
        if (!ids || !Number.isSafeInteger(base) || !Number.isSafeInteger(every) ||
            !Number.isSafeInteger(amount) || base <= 0 || every <= 0 || amount <= 0) return null;
        return {
            palletCount: ids.length,
            firstGroupEnd: ids[Math.min(every, ids.length) - 1],
            firstLimit: base,
            lastLimit: base - Math.floor((ids.length - 1) / every) * amount,
        };
    }, [addMode, cycleSteppingEnabled, cycleStepAmount, cycleStepEvery, newId, newLastId, newMaxCycles]);

    const {totalPallets, availableStock, blockedOrMaint} = useMemo(() => pallets.reduce(
        (totals, pallet) => {
            totals.totalPallets += 1;
            if (pallet.status === 'Active') totals.availableStock += 1;
            else totals.blockedOrMaint += 1;
            return totals;
        },
        {totalPallets: 0, availableStock: 0, blockedOrMaint: 0},
    ), [pallets]);
    const avaliblePalletes_Percenetege = Math.min(100, Math.round((availableStock / totalPallets) * 100)) || 0;

    const fetchPallets = async () => {
        try {
            await refreshPalletData(queryClient);
        } catch (error) {
            console.error("Failed to fetch pallets:", error);
            showGlobalError(t('error_fetching_pallets_title'), getErrorMessage(error, t('error_connecting_to_encore')));
        }
    };

    const resetAddPalletForm = () => {
        setNewId('');
        setNewLastId('');
        setAddMode('single');
        setNewProject('');
        setNewModel('');
        setNewMaxCycles('200');
        setCycleSteppingEnabled(false);
        setCycleStepEvery('10');
        setCycleStepAmount('10');
        setNewNests('1');
        setNewFis('1');
        setNewMachine('');
        setValidationError('');
    };

    const handleOpenAddPallet = () => {
        resetAddPalletForm();
        setIsAddOpen(true);
    };

    const handleCopyPallet = (pallet: Pallet) => {
        setNewId('');
        setNewLastId('');
        setAddMode('single');
        setNewProject(pallet.project);
        setNewModel(pallet.model);
        setNewMaxCycles(String(pallet.max_cycles));
        setCycleSteppingEnabled(false);
        setCycleStepEvery('10');
        setCycleStepAmount('10');
        setNewNests(String(pallet.nests));
        setNewFis(String(pallet.fis));
        setNewMachine(pallet.machine);
        setValidationError('');
        setIsAddOpen(true);
    };

    const handleAddPallet = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setValidationError('');

        const palletId = newId.trim().toUpperCase();
        const lastPalletId = newLastId.trim().toUpperCase();
        const rangeIds = addMode === 'range' ? expandRange(palletId, lastPalletId) : [palletId];

        if (!palletId) {
            setValidationError(t('validation_error_pallet_id'));
            return;
        }
        if (!rangeIds) {
            setValidationError(t('pallet_range_invalid'));
            return;
        }
        const existingIds = new Set(pallets.map((pallet) => pallet.pallet_id.toUpperCase()));
        if (rangeIds.some((id) => existingIds.has(id))) {
            setValidationError(t('pallet_exists'));
            return;
        }
        if (!newProject) {
            setValidationError(t('project_required'));
            return;
        }
        if (!newModel || !newPalletModels.includes(newModel)) {
            setValidationError(t('model_required'));
            return;
        }
        if (!newMachine) { setValidationError(t('machine_invalid')); return; }
        if (!newFis || parseInt(newFis) <= 0) {
            setValidationError(t('fis_invalid'));
            return;
        }
        const stepEvery = Number(cycleStepEvery);
        const stepAmount = Number(cycleStepAmount);
        if (addMode === 'range' && cycleSteppingEnabled) {
            const lastMaxCycles = Number(newMaxCycles) - Math.floor((rangeIds.length - 1) / stepEvery) * stepAmount;
            if (!Number.isSafeInteger(stepEvery) || !Number.isSafeInteger(stepAmount) ||
                stepEvery <= 0 || stepAmount <= 0 || !Number.isSafeInteger(lastMaxCycles) || lastMaxCycles <= 0 || lastMaxCycles > 1_000_000) {
                setValidationError(t('cycle_step_invalid'));
                return;
            }
        }

        try {
            setIsSubmitting(true);

            const fisValue = Number(newFis);
            if (fisValue !== 1 && fisValue !== 2) {
                setValidationError(t('fis_invalid'));
                return;
            }
            const fis: 1 | 2 = fisValue;
            const details = {
                machine: newMachine,
                project: newProject,
                model: newModel,
                max_cycles: parseInt(newMaxCycles) || 200,
                nests: parseInt(newNests) || 1,
                fis,
                status: "Active" as const,
                acceptLanguage: language,
            };
            if (addMode === 'range') {
                await apiClient.pallet.AddPalletRange({
                    ...details,
                    first_pallet_id: palletId,
                    last_pallet_id: lastPalletId,
                    ...(cycleSteppingEnabled ? {
                        cycle_step_every: stepEvery,
                        cycle_step_amount: stepAmount,
                    } : {}),
                });
            } else {
                await apiClient.pallet.AddPallet({...details, pallet_id: palletId});
            }

            await fetchPallets();
            resetAddPalletForm();
            notify(language === 'pl' ? 'Operacja zakończona pomyślnie.' : 'Operation completed successfully.');
            setIsAddOpen(false);
        } catch (error) {
            console.error('Error adding pallet:', error);
            setValidationError(getErrorMessage(error, t('error_connecting_to_encore')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBlockClick = (pallet: Pallet) => {
        setSelectedPalletForBlock(pallet);
        setBlockReason('');
        setBlockError('');
        setIsBlockOpen(true);
    };

    const handleConfirmBlock = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedPalletForBlock) return;

        if (!blockReason.trim()) {
            setBlockError(t('block_reason_required'));
            return;
        }

        try {
            setIsSubmitting(true);
            setBlockError('');

            await apiClient.pallet.BlockPallet({
                pallet_id: selectedPalletForBlock.pallet_id,
                block_reason: blockReason.trim(),
                acceptLanguage: language,
            });

            await fetchPallets();
            setIsBlockOpen(false);
            notify(language === 'pl' ? 'Operacja zakończona pomyślnie.' : 'Operation completed successfully.');
            setSelectedPalletForBlock(null);
            setBlockReason("");
        } catch (err) {
            console.error('Error blocking pallet:', err);
            setBlockError(getErrorMessage(err, t('error_connecting_to_encore')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnblock = (pallet: Pallet) => {
        setUnblockComment('');
        setUnblockError('');
        setSelectedPalletForUnblock(pallet);
    };
    const closeUnblock = () => {
        if (!unblockRunningRef.current) setSelectedPalletForUnblock(null);
    };
    const handleConfirmUnblock = async () => {
        if (!selectedPalletForUnblock || unblockRunningRef.current) return;
        if (!unblockComment.trim()) { setUnblockError(t('unblock_comment_required')); return; }
        unblockRunningRef.current = true;
        setIsSubmitting(true);
        setUnblockError('');
        try {
            await apiClient.pallet.UnblockPallet({comment: unblockComment.trim(), pallet_id: selectedPalletForUnblock.pallet_id, acceptLanguage: language});
            setSelectedPalletForUnblock(null);
            notify(language === 'pl' ? 'Paleta została odblokowana.' : 'Pallet unblocked.');
            await fetchPallets();
        } catch (error) {
            setUnblockError(getErrorMessage(error, t('error_connecting_to_encore')));
        } finally {
            unblockRunningRef.current = false;
            setIsSubmitting(false);
        }
    };

    const handleConfirmDeletePallet = async () => {
        if (!selectedPalletForDelete) return;
        const palletId = selectedPalletForDelete.pallet_id;

        try {
            setIsSubmitting(true);
            await apiClient.pallet.DeletePallet(palletId, {acceptLanguage: language});

            await fetchPallets();
            setSelectedPalletForDelete(null);
            notify(language === 'pl' ? 'Operacja zakończona pomyślnie.' : 'Operation completed successfully.');
        } catch (err) {
            console.error('Error deleting pallet:', err);
            showGlobalError(t('error_deleting_pallet_title'), getErrorMessage(err, t('error_connecting_to_encore')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRefreshPallets = async () => {
        setIsRefreshing(true);
        await fetchPallets();
        setTimeout(() => setIsRefreshing(false), 400);
    };

    const handleOpenEditModal = (pallet: Pallet) => {
        setSelectedPalletForEdit(pallet);
        setEditFis(String(pallet.fis ?? 1));
        setEditMachine(pallet.machine);
        setEditNests(String(pallet.nests ?? 1));
        setEditMaxCycles(String(pallet.max_cycles ?? 200));
        setEditStatus(pallet.status || 'Active');
        setEditBlockReason(pallet.block_reason || '');
        setEditUnblockComment('');
        setEditError('');
        setIsEditOpen(true);
    };

    const handleUpdatePallet = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedPalletForEdit) return;

        const fisVal = parseInt(editFis);
        const nestsVal = parseInt(editNests);
        const maxCyclesVal = parseInt(editMaxCycles);

        if (isNaN(fisVal) || fisVal <= 0) {
            setEditError(t('fis_invalid'));
            return;
        }
        if (isNaN(nestsVal) || nestsVal <= 0) {
            setEditError(t('validation_required_fields'));
            return;
        }
        if (isNaN(maxCyclesVal) || maxCyclesVal <= 0) {
            setEditError(t('validation_required_fields'));
            return;
        }
        if (selectedPalletForEdit.status === 'Blocked' && editStatus !== 'Blocked' && !editUnblockComment.trim()) { setEditError(t('unblock_comment_required')); return; }
        if (editStatus === 'Blocked' && !editBlockReason.trim()) {
            setEditError(t('block_reason_required'));
            return;
        }

        try {
            setIsSubmitting(true);
            setEditError('');

            if (fisVal !== 1 && fisVal !== 2) {
                setEditError(t('fis_invalid'));
                return;
            }
            await apiClient.pallet.UpdatePallet(selectedPalletForEdit.pallet_id, {
                machine: editMachine,
                fis: fisVal,
                nests: nestsVal,
                max_cycles: maxCyclesVal,
                status: editStatus,
                block_reason: editStatus === 'Blocked' ? editBlockReason.trim() : selectedPalletForEdit.status === 'Blocked' ? editUnblockComment.trim() : null,
                acceptLanguage: language,
            });

            await fetchPallets();
            setIsEditOpen(false);
            notify(language === 'pl' ? 'Operacja zakończona pomyślnie.' : 'Operation completed successfully.');
            setSelectedPalletForEdit(null);
        } catch (err) {
            console.error('Error updating pallet:', err);
            setEditError(getErrorMessage(err, t('error_connecting_to_encore')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExportAuditTrail = async () => {
        try {
            const history = [];
            let beforeId: number | undefined;
            do {
                const page = await apiClient.pallet.GetAllPalletHistory({
                    limit: 500,
                    before_id: beforeId,
                    acceptLanguage: language,
                });
                history.push(...page.history);
                beforeId = page.next_cursor;
            } while (beforeId !== undefined);

            const dataStr = 'data:text/json;charset=utf-8,' +
                encodeURIComponent(JSON.stringify(history, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute(
                'download',
                `dash-solder-audit-trail-${new Date().toISOString().split('T')[0]}.json`,
            );
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            notify(language === 'pl' ? 'Operacja zakończona pomyślnie.' : 'Operation completed successfully.');
        } catch (error) {
            console.error('Error exporting audit trail:', error);
            showGlobalError(t('error_fetching_audit_history_title'), getErrorMessage(error, t('error_connecting_to_encore')));
        }
    };

    return {
        data: {
            pallets,
            projects,
            models,
            isAddOpen,
            isBlockOpen,
            isEditOpen,
            selectedPalletForBlock,
            blockReason,
            selectedPalletForEdit,
            selectedPalletForDelete,
            selectedPalletForUnblock,
            unblockError, unblockComment,
            editFis, editMachine,
            editNests,
            editMaxCycles,
            editStatus,
            editBlockReason, editUnblockComment,
            editError,
            newId,
            newLastId,
            addMode,
            newModel,
            newProject,
            newMaxCycles,
            cycleSteppingEnabled,
            cycleStepEvery,
            cycleStepAmount,
            rangeCyclePreview,
            newNests,
            newFis, newMachine,
            validationError,
            blockError,
            filteredPallets,
            sort,
            totalPallets,
            availableStock,
            blockedOrMaint,
            errorModalState,
            avaliblePalletes_Percenetege,
            paginatedPallets,
            pageSize,
            currentPage: safeCurrentPage,
            totalPages,
            availableModels,
            newPalletModels,
        },
        status: {
            isSubmitting,
            isRefreshing,
        },
        actions: {
            setSearchTerm: updateSearchTerm,
            setSelectedProject: updateSelectedProject,
            setSelectedModel: updateSelectedModel,
            setSelectedStatus: updateSelectedStatus,
            setSelectedMachine: updateSelectedMachine,
            setCurrentPage,
            setSort: updateSort,
            setIsAddOpen: (open: boolean) => {
                setValidationError('');
                setIsAddOpen(open);
            },
            setIsEditOpen: (open: boolean) => {
                setEditError('');
                setIsEditOpen(open);
            },
            setIsBlockOpen: (open: boolean) => {
                setBlockError('');
                setIsBlockOpen(open);
            },
            setSelectedPalletForBlock,
            setBlockReason,
            setSelectedPalletForEdit,
            setSelectedPalletForDelete,
            setEditFis, setEditMachine,
            setEditNests,
            setEditMaxCycles,
            setEditStatus,
            setEditBlockReason, setEditUnblockComment,
            setEditError,
            setNewId,
            setNewLastId,
            setAddMode,
            setNewModel,
            setNewProject: (project: string) => {
                setNewProject(project);
                setNewModel('');
            },
            setNewMaxCycles,
            setCycleSteppingEnabled,
            setCycleStepEvery,
            setCycleStepAmount,
            setNewNests,
            setNewFis, setNewMachine,
            setValidationError,
            handleAddPallet,
            handleOpenAddPallet,
            handleCopyPallet,
            handleBlockClick,
            handleConfirmBlock,
            handleUnblock,
            handleConfirmUnblock, setUnblockComment,
            closeUnblock,
            handleConfirmDeletePallet,
            handleOpenEditModal,
            handleUpdatePallet,
            handleExportAuditTrail,
            handleRefreshPallets,
            showGlobalError,
            hideGlobalError,
            setPageSize: updatePageSize,
        },
    };
};
