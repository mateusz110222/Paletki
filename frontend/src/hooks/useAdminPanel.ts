import React, {useState} from 'react';
import {Pallet, PalletStatus, Project} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useAuth} from "../auth/AuthContext.tsx";
import {useGlobalErrorModal} from "./useGlobalErrorModal.ts";
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";

interface UseAdminPanelProps {
    pallets: Pallet[];
    projects: Project[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

export const useAdminPanel = ({
                                  pallets,
                                  projects,
                                  setPallets,
                                  setProjects,
                              }: UseAdminPanelProps) => {
    const {t, language} = useTranslation();
    const {user} = useAuth();

    const Operator = user?.FullName ?? "";
    const {errorModalState, showGlobalError, hideGlobalError} = useGlobalErrorModal();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProject, setSelectedProject] = useState('ALL');
    const [selectedModel, setSelectedModel] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');

    // Modals state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
    const [isBlockOpen, setIsBlockOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedPalletForBlock, setSelectedPalletForBlock] = useState<Pallet | null>(null);
    const [selectedPalletForAudit, setSelectedPalletForAudit] = useState<Pallet | null>(null);
    const [selectedPalletForEdit, setSelectedPalletForEdit] = useState<Pallet | null>(null);

    // Form inputs state
    const [newProjectName, setNewProjectName] = useState('');
    const [blockReason, setBlockReason] = useState('');
    const [newId, setNewId] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newProject, setNewProject] = useState('');
    const [newMaxCycles, setNewMaxCycles] = useState('200');
    const [newNests, setNewNests] = useState('1');
    const [newFis, setNewFis] = useState('1');
    const [newStatus, setNewStatus] = useState<PalletStatus>('Active');
    const [newBlockReason, setNewBlockReason] = useState('');

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

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const filteredPallets = (pallets || []).filter((p) => {
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
    });

    const totalPages = Math.max(1, Math.ceil(filteredPallets.length / pageSize));
    const paginatedPallets = filteredPallets.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const totalPallets = pallets.length;
    const availableStock = pallets.filter((p) => p.status === 'Active').length;
    const blockedOrMaint = pallets.filter((p) => ['Blocked', 'Washing_Required', 'Damaged'].includes(p.status as PalletStatus)).length;
    const avaliblePalletes_Percenetege = Math.min(100, Math.round((availableStock / totalPallets) * 100)) || 0;

    const fetchPallets = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/pallets`);
            if (res.ok) {
                const data = await res.json();
                setPallets(data.pallets || []);
            } else {
                const errData = await res.json();
                showGlobalError(t('error_fetching_pallets_title'), errData.message || t('error_connecting_to_encore'));
            }
        } catch (error) {
            console.error("Failed to fetch pallets:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            showGlobalError(t('error_fetching_pallets_title'), errorMessage || t('error_connecting_to_encore'));
        }
    };

    const resetAddPalletForm = () => {
        setNewId('');
        setNewProject('');
        setNewModel('');
        setNewMaxCycles('200');
        setNewNests('1');
        setNewFis('1');
        setNewStatus('Active');
        setNewBlockReason('');
        setValidationError('');
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
        if (!newFis || parseInt(newFis) <= 0) {
            setValidationError(t('fis_invalid'));
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                pallet_id: palletId,
                project: newProject,
                model: newModel,
                max_cycles: parseInt(newMaxCycles) || 200,
                nests: parseInt(newNests) || 1,
                fis: parseInt(newFis) || 1,
                created_by: Operator,
                status: "Active",
            };

            const response = await fetch(`${API_BASE_URL}/pallets`, {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept-Language": language},
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || t('database_error'));
            }

            await fetchPallets();
            resetAddPalletForm();
            setIsAddOpen(false);
        } catch (error) {
            console.error('Error adding pallet:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            setValidationError(errorMessage || t('error_connecting_to_encore'));
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

            const payload = {name: projectName};

            const response = await fetch(`${API_BASE_URL}/projects`, {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept-Language": language},
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || t('error_connecting_to_encore'));
            }

            const res = await fetch(`${API_BASE_URL}/projects`);
            if (res.ok) {
                const data = await res.json();
                setProjects(data.projects || []);
            } else {
                const errData = await res.json();
                showGlobalError(t('error_fetching_projects_title'), errData.message || t('error_connecting_to_encore'));
            }

            setNewProjectName('');
            setIsAddProjectOpen(false);
        } catch (error) {
            console.error('Error adding project:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            setValidationError(errorMessage || t('error_connecting_to_encore'));
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

            const response = await fetch(`${API_BASE_URL}/pallets/block`, {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept-Language": language},
                body: JSON.stringify({
                    pallet_id: selectedPalletForBlock.pallet_id,
                    block_reason: blockReason.trim(),
                    operator_id: Operator
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || t('error_connecting_to_encore'));
            }

            await fetchPallets();
            setIsBlockOpen(false);
            setSelectedPalletForBlock(null);
            setBlockReason("");
        } catch (err) {
            console.error('Error blocking pallet:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setBlockError(errorMessage || t('error_connecting_to_encore'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnblock = async (pallet: Pallet) => {
        if (!window.confirm(t('confirm_unblock_message'))) return;

        try {
            const response = await fetch(`${API_BASE_URL}/pallets/unblock`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language
                },
                body: JSON.stringify({
                    pallet_id: pallet.pallet_id,
                    operator_id: Operator
                })
            });

            const resData = await response.json().catch(() => ({}));

            if (!response.ok) {
                showGlobalError(t('error_unblocking_pallet_title'), resData.message || t('error_connecting_to_encore'));
                return;
            }

            await fetchPallets();
        } catch (err) {
            console.error('Error unblocking pallet:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            showGlobalError(t('error_unblocking_pallet_title'), errorMessage || t('error_connecting_to_encore'));
        }
    };

    const handleDeletePallet = async (palletId: string) => {
        if (!window.confirm(t('delete_pallet_confirm'))) return;

        try {
            const response = await fetch(`${API_BASE_URL}/pallets/${palletId}`, {
                method: "DELETE",
                headers: {"Accept-Language": language},
            });

            const resData = await response.json().catch(() => ({}));

            if (!response.ok) {
                showGlobalError(t('error_deleting_pallet_title'), resData.message || t('error_connecting_to_encore'));
                return;
            }

            await fetchPallets();
        } catch (err) {
            console.error('Error deleting pallet:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            showGlobalError(t('error_deleting_pallet_title'), errorMessage || t('error_connecting_to_encore'));
        }
    };

    const handleOpenAuditModal = async (pallet: Pallet) => {
        setSelectedPalletForAudit(pallet);
        hideGlobalError();

        try {
            const response = await fetch(`${API_BASE_URL}/pallets/${pallet.pallet_id}/history`, {
                headers: {
                    "Accept-Language": language
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                showGlobalError(t('error_fetching_audit_history_title'), errData.message || t('failed_to_fetch_history'));
                return;
            }

            const data = await response.json();

            setSelectedPalletForAudit(prev => prev ? {
                ...prev,
                history: data.history || []
            } : null);

        } catch (err) {
            console.error("Błąd pobierania historii audytowej:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            showGlobalError(t('error_fetching_audit_history_title'), errorMessage || t('failed_to_fetch_history'));
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

            const payload = {
                pallet_id: selectedPalletForEdit.pallet_id,
                fis: fisVal,
                nests: nestsVal,
                max_cycles: maxCyclesVal,
                status: editStatus,
                block_reason: editStatus === 'Blocked' ? editBlockReason.trim() : null,
                operator_id: Operator
            };

            const response = await fetch(`${API_BASE_URL}/pallets/${selectedPalletForEdit.pallet_id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || t('database_error'));
            }

            await fetchPallets();
            setIsEditOpen(false);
            setSelectedPalletForEdit(null);
        } catch (err) {
            console.error('Error updating pallet:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setEditError(errorMessage || t('database_error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExportAuditTrail = () => {
        const allHistory = pallets.flatMap((p) => p.history || []);
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allHistory, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `dash-solder-audit-trail-${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    return {
        data: {
            pallets,
            projects,
            searchTerm,
            selectedProject,
            selectedModel,
            selectedStatus,
            isAddOpen,
            isAddProjectOpen,
            newProjectName,
            isBlockOpen,
            isEditOpen,
            selectedPalletForBlock,
            blockReason,
            selectedPalletForAudit,
            selectedPalletForEdit,
            editFis,
            editNests,
            editMaxCycles,
            editStatus,
            editBlockReason,
            editError,
            Operator,
            newId,
            newModel,
            newProject,
            newMaxCycles,
            newNests,
            newFis,
            newStatus,
            newBlockReason,
            validationError,
            blockError,
            filteredPallets,
            totalPallets,
            availableStock,
            blockedOrMaint,
            errorModalState,
            avaliblePalletes_Percenetege,
            paginatedPallets,
            currentPage,
            pageSize,
            totalPages,
        },
        status: {
            isSubmitting,
            isRefreshing,
        },
        actions: {
            setSearchTerm,
            setSelectedProject,
            setSelectedModel,
            setSelectedStatus,
            setIsAddOpen: (open: boolean) => {
                setValidationError('');
                setIsAddOpen(open);
            },
            setIsAddProjectOpen: (open: boolean) => {
                setValidationError('');
                setIsAddProjectOpen(open);
            },
            setIsEditOpen: (open: boolean) => {
                setEditError('');
                setIsEditOpen(open);
            },
            setNewProjectName,
            setIsBlockOpen: (open: boolean) => {
                setBlockError('');
                setIsBlockOpen(open);
            },
            setSelectedPalletForBlock,
            setBlockReason,
            setSelectedPalletForAudit,
            setSelectedPalletForEdit,
            setEditFis,
            setEditNests,
            setEditMaxCycles,
            setEditStatus,
            setEditBlockReason,
            setEditError,
            setNewId,
            setNewModel,
            setNewProject,
            setNewMaxCycles,
            setNewNests,
            setNewFis,
            setNewStatus,
            setNewBlockReason,
            setValidationError,
            handleAddPallet,
            handleAddProject,
            handleBlockClick,
            handleConfirmBlock,
            handleUnblock,
            handleDeletePallet,
            handleOpenAuditModal,
            handleOpenEditModal,
            handleUpdatePallet,
            handleExportAuditTrail,
            handleRefreshPallets,
            showGlobalError,
            hideGlobalError,
            setCurrentPage,
            setPageSize: (size: number) => {
                setPageSize(size);
                setCurrentPage(1);
            },
        },
    };
};