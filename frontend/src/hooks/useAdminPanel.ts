import React, {useMemo, useState} from 'react';
import {getErrorMessage} from '../lib/errors';
import {Pallet, PalletModel, PalletStatus, Project} from '@backend/shared/types';
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

export const useAdminPanel = ({
                                  pallets,
                                  projects,
                                  models,
                              }: UseAdminPanelProps) => {
    const {t, language} = useTranslation();
    const {apiClient} = useAuth();
    const queryClient = useQueryClient();
    const {errorModalState, showGlobalError, hideGlobalError} = useGlobalErrorModal();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProject, setSelectedProject] = useState('ALL');
    const [selectedModel, setSelectedModel] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');

    // Modals state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
    const [isAddModelOpen, setIsAddModelOpen] = useState(false);
    const [isBlockOpen, setIsBlockOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedPalletForBlock, setSelectedPalletForBlock] = useState<Pallet | null>(null);
    const [selectedPalletForEdit, setSelectedPalletForEdit] = useState<Pallet | null>(null);
    const [selectedPalletForDelete, setSelectedPalletForDelete] = useState<Pallet | null>(null);

    // Form inputs state
    const [newProjectName, setNewProjectName] = useState('');
    const [newModelName, setNewModelName] = useState('');
    const [newModelProject, setNewModelProject] = useState('');
    const [blockReason, setBlockReason] = useState('');
    const [newId, setNewId] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newProject, setNewProject] = useState('');
    const [newMaxCycles, setNewMaxCycles] = useState('200');
    const [newNests, setNewNests] = useState('1');
    const [newFis, setNewFis] = useState('1');

    // Edit Form inputs state
    const [editFis, setEditFis] = useState('1');
    const [editNests, setEditNests] = useState('1');
    const [editMaxCycles, setEditMaxCycles] = useState('200');
    const [editStatus, setEditStatus] = useState<PalletStatus>('Active');
    const [editBlockReason, setEditBlockReason] = useState('');

    // Error & Status handling
    const [validationError, setValidationError] = useState('');
    const [blockError, setBlockError] = useState('');
    const [editError, setEditError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    const filteredPallets = useMemo(() => (pallets || []).filter((p) => {
        const palletId = p.pallet_id || '';
        const project = p.project || '';
        const createdBy = p.created_by || '';

        const matchesSearch = palletId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.toLowerCase().includes(searchTerm.toLowerCase()) ||
            createdBy.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = selectedProject === 'ALL' || project === selectedProject;
        const matchesModel = selectedModel === 'ALL' || p.model === selectedModel;
        const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;

        return matchesSearch && matchesProject && matchesModel && matchesStatus;
    }), [pallets, searchTerm, selectedModel, selectedProject, selectedStatus]);

    const totalPages = Math.max(1, Math.ceil(filteredPallets.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedPallets = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return filteredPallets.slice(start, start + pageSize);
    }, [filteredPallets, safeCurrentPage, pageSize]);

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
            await queryClient.invalidateQueries({queryKey: ['pallets']});
        } catch (error) {
            console.error("Failed to fetch pallets:", error);
            showGlobalError(t('error_fetching_pallets_title'), getErrorMessage(error, t('error_connecting_to_encore')));
        }
    };

    const resetAddPalletForm = () => {
        setNewId('');
        setNewProject('');
        setNewModel('');
        setNewMaxCycles('200');
        setNewNests('1');
        setNewFis('1');
        setValidationError('');
    };

    const handleOpenAddPallet = () => {
        resetAddPalletForm();
        setIsAddOpen(true);
    };

    const handleCopyPallet = (pallet: Pallet) => {
        setNewId('');
        setNewProject(pallet.project);
        setNewModel(pallet.model);
        setNewMaxCycles(String(pallet.max_cycles));
        setNewNests(String(pallet.nests));
        setNewFis(String(pallet.fis));
        setValidationError('');
        setIsAddOpen(true);
    };

    const handleAddPallet = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setValidationError('');

        const palletId = newId.trim().toUpperCase();

        if (!palletId) {
            setValidationError(t('validation_error_pallet_id'));
            return;
        }
        if (pallets.some((p) => p.pallet_id?.toUpperCase() === palletId)) {
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
        if (!newFis || parseInt(newFis) <= 0) {
            setValidationError(t('fis_invalid'));
            return;
        }

        try {
            setIsSubmitting(true);

            const fis = Number(newFis);
            if (fis !== 1 && fis !== 2) {
                setValidationError(t('fis_invalid'));
                return;
            }
            await apiClient.pallet.AddPallet({
                pallet_id: palletId,
                project: newProject,
                model: newModel,
                max_cycles: parseInt(newMaxCycles) || 200,
                nests: parseInt(newNests) || 1,
                fis,
                status: "Active",
                acceptLanguage: language,
            });

            await fetchPallets();
            resetAddPalletForm();
            setIsAddOpen(false);
        } catch (error) {
            console.error('Error adding pallet:', error);
            setValidationError(getErrorMessage(error, t('error_connecting_to_encore')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddProject = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setValidationError('');

        const projectName = newProjectName.trim();

        if (!projectName) {
            setValidationError(t('project_name_empty'));
            return;
        }

        try {
            setIsSubmitting(true);

            await apiClient.pallet.AddProject({name: projectName, acceptLanguage: language});
            await queryClient.invalidateQueries({queryKey: ['projects']});

            setNewProjectName('');
            setIsAddProjectOpen(false);
        } catch (error) {
            console.error('Error adding project:', error);
            setValidationError(getErrorMessage(error, t('error_connecting_to_encore')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddModel = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setValidationError('');

        const modelName = newModelName.trim();
        if (!newModelProject) {
            setValidationError(t('project_required'));
            return;
        }
        if (!modelName) {
            setValidationError(t('model_name_empty'));
            return;
        }

        try {
            setIsSubmitting(true);
            await apiClient.pallet.AddModel({
                project: newModelProject,
                name: modelName,
                acceptLanguage: language,
            });
            await queryClient.invalidateQueries({queryKey: ['models']});
            setNewModelName('');
            setNewModelProject('');
            setIsAddModelOpen(false);
        } catch (error) {
            console.error('Error adding model:', error);
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
            setSelectedPalletForBlock(null);
            setBlockReason("");
        } catch (err) {
            console.error('Error blocking pallet:', err);
            setBlockError(getErrorMessage(err, t('error_connecting_to_encore')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnblock = async (pallet: Pallet) => {
        if (!window.confirm(t('confirm_unblock_message'))) return;

        try {
            await apiClient.pallet.UnblockPallet({
                pallet_id: pallet.pallet_id,
                acceptLanguage: language,
            });

            await fetchPallets();
        } catch (err) {
            console.error('Error unblocking pallet:', err);
            showGlobalError(t('error_unblocking_pallet_title'), getErrorMessage(err, t('error_connecting_to_encore')));
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
        setEditNests(String(pallet.nests ?? 1));
        setEditMaxCycles(String(pallet.max_cycles ?? 200));
        setEditStatus(pallet.status || 'Active');
        setEditBlockReason(pallet.block_reason || '');
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
                fis: fisVal,
                nests: nestsVal,
                max_cycles: maxCyclesVal,
                status: editStatus,
                block_reason: editStatus === 'Blocked' ? editBlockReason.trim() : null,
                acceptLanguage: language,
            });

            await fetchPallets();
            setIsEditOpen(false);
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
            isAddProjectOpen,
            isAddModelOpen,
            newProjectName,
            newModelName,
            newModelProject,
            isBlockOpen,
            isEditOpen,
            selectedPalletForBlock,
            blockReason,
            selectedPalletForEdit,
            selectedPalletForDelete,
            editFis,
            editNests,
            editMaxCycles,
            editStatus,
            editBlockReason,
            editError,
            newId,
            newModel,
            newProject,
            newMaxCycles,
            newNests,
            newFis,
            validationError,
            blockError,
            filteredPallets,
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
            setSearchTerm: (term: string) => {
                setSearchTerm(term);
                setCurrentPage(1);
            },
            setSelectedProject: (proj: string) => {
                setSelectedProject(proj);
                setCurrentPage(1);
            },
            setSelectedModel: (model: string) => {
                setSelectedModel(model);
                setCurrentPage(1);
            },
            setSelectedStatus: (status: string) => {
                setSelectedStatus(status);
                setCurrentPage(1);
            },
            setCurrentPage,
            setIsAddOpen: (open: boolean) => {
                setValidationError('');
                setIsAddOpen(open);
            },
            setIsAddProjectOpen: (open: boolean) => {
                setValidationError('');
                setIsAddProjectOpen(open);
            },
            setIsAddModelOpen: (open: boolean) => {
                setValidationError('');
                setIsAddModelOpen(open);
            },
            setIsEditOpen: (open: boolean) => {
                setEditError('');
                setIsEditOpen(open);
            },
            setNewProjectName,
            setNewModelName,
            setNewModelProject,
            setIsBlockOpen: (open: boolean) => {
                setBlockError('');
                setIsBlockOpen(open);
            },
            setSelectedPalletForBlock,
            setBlockReason,
            setSelectedPalletForEdit,
            setSelectedPalletForDelete,
            setEditFis,
            setEditNests,
            setEditMaxCycles,
            setEditStatus,
            setEditBlockReason,
            setEditError,
            setNewId,
            setNewModel,
            setNewProject: (project: string) => {
                setNewProject(project);
                setNewModel('');
            },
            setNewMaxCycles,
            setNewNests,
            setNewFis,
            setValidationError,
            handleAddPallet,
            handleAddProject,
            handleAddModel,
            handleOpenAddPallet,
            handleCopyPallet,
            handleBlockClick,
            handleConfirmBlock,
            handleUnblock,
            handleConfirmDeletePallet,
            handleOpenEditModal,
            handleUpdatePallet,
            handleExportAuditTrail,
            handleRefreshPallets,
            showGlobalError,
            hideGlobalError,
            setPageSize: (size: number) => {
                setPageSize(size);
                setCurrentPage(1);
            },
        },
    };
};
