import React, {useState} from 'react';
import {Pallet, PalletStatus, Project} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useGlobalErrorModal} from "./useGlobalErrorModal.ts";
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";
import {useAuth} from "../auth/AuthContext.tsx";

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
    const {authenticatedFetch} = useAuth();
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
    const [selectedPalletForEdit, setSelectedPalletForEdit] = useState<Pallet | null>(null);
    const [selectedPalletForDelete, setSelectedPalletForDelete] = useState<Pallet | null>(null);

    // Form inputs state
    const [newProjectName, setNewProjectName] = useState('');
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

    const paginatedPallets = filteredPallets.slice(0, pageSize);

    const totalPallets = pallets.length;
    const availableStock = pallets.filter((p) => p.status === 'Active').length;
    const blockedOrMaint = pallets.filter((p) => ['Blocked', 'Washing_Required', 'Damaged'].includes(p.status as PalletStatus)).length;
    const avaliblePalletes_Percenetege = Math.min(100, Math.round((availableStock / totalPallets) * 100)) || 0;

    const fetchPallets = async () => {
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
        } catch (error) {
            console.error("Failed to fetch pallets:", error);
            showGlobalError(t('error_fetching_pallets_title'), t('error_connecting_to_encore'));
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
                status: "Active",
            };

            const response = await authenticatedFetch(`${API_BASE_URL}/pallets`, {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept-Language": language},
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                setValidationError(errData.message);
                return;
            }

            await fetchPallets();
            resetAddPalletForm();
            setIsAddOpen(false);
        } catch (error) {
            console.error('Error adding pallet:', error);
            setValidationError(t('error_connecting_to_encore'));
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

            const response = await authenticatedFetch(`${API_BASE_URL}/projects`, {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept-Language": language},
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                setValidationError(errData.message);
                return;
            }

            const res = await fetch(`${API_BASE_URL}/projects`, {
                headers: {"Accept-Language": language},
            });
            if (res.ok) {
                const data = await res.json();
                setProjects(data.projects || []);
            } else {
                const errData = await res.json();
                showGlobalError(t('error_fetching_projects_title'), errData.message);
            }

            setNewProjectName('');
            setIsAddProjectOpen(false);
        } catch (error) {
            console.error('Error adding project:', error);
            setValidationError(t('error_connecting_to_encore'));
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

            const response = await authenticatedFetch(`${API_BASE_URL}/pallets/block`, {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept-Language": language},
                body: JSON.stringify({
                    pallet_id: selectedPalletForBlock.pallet_id,
                    block_reason: blockReason.trim()
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                setBlockError(errData.message);
                return;
            }

            await fetchPallets();
            setIsBlockOpen(false);
            setSelectedPalletForBlock(null);
            setBlockReason("");
        } catch (err) {
            console.error('Error blocking pallet:', err);
            setBlockError(t('error_connecting_to_encore'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnblock = async (pallet: Pallet) => {
        if (!window.confirm(t('confirm_unblock_message'))) return;

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/pallets/unblock`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language
                },
                body: JSON.stringify({
                    pallet_id: pallet.pallet_id
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                showGlobalError(t('error_unblocking_pallet_title'), errData.message);
                return;
            }

            await fetchPallets();
        } catch (err) {
            console.error('Error unblocking pallet:', err);
            showGlobalError(t('error_unblocking_pallet_title'), t('error_connecting_to_encore'));
        }
    };

    const handleConfirmDeletePallet = async () => {
        if (!selectedPalletForDelete) return;
        const palletId = selectedPalletForDelete.pallet_id;

        try {
            setIsSubmitting(true);
            const response = await authenticatedFetch(`${API_BASE_URL}/pallets/${encodeURIComponent(palletId)}`, {
                method: "DELETE",
                headers: {"Accept-Language": language},
            });

            if (!response.ok) {
                const errData = await response.json();
                showGlobalError(t('error_deleting_pallet_title'), errData.message);
                return;
            }

            await fetchPallets();
            setSelectedPalletForDelete(null);
        } catch (err) {
            console.error('Error deleting pallet:', err);
            showGlobalError(t('error_deleting_pallet_title'), t('error_connecting_to_encore'));
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

            const payload = {
                pallet_id: selectedPalletForEdit.pallet_id,
                fis: fisVal,
                nests: nestsVal,
                max_cycles: maxCyclesVal,
                status: editStatus,
                block_reason: editStatus === 'Blocked' ? editBlockReason.trim() : null
            };

            const response = await authenticatedFetch(`${API_BASE_URL}/pallets/${encodeURIComponent(selectedPalletForEdit.pallet_id)}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                setEditError(errData.message);
                return;
            }

            await fetchPallets();
            setIsEditOpen(false);
            setSelectedPalletForEdit(null);
        } catch (err) {
            console.error('Error updating pallet:', err);
            setEditError(t('error_connecting_to_encore'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExportAuditTrail = async () => {
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/pallets/audit-history`, {
                headers: {"Accept-Language": language},
            });
            const responseData = await response.json();
            if (!response.ok) {
                showGlobalError(t('error_fetching_audit_history_title'), responseData.message);
                return;
            }

            const dataStr = 'data:text/json;charset=utf-8,' +
                encodeURIComponent(JSON.stringify(responseData.history || [], null, 2));
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
            showGlobalError(t('error_fetching_audit_history_title'), t('error_connecting_to_encore'));
        }
    };

    return {
        data: {
            pallets,
            projects,
            isAddOpen,
            isAddProjectOpen,
            newProjectName,
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
            setNewProject,
            setNewMaxCycles,
            setNewNests,
            setNewFis,
            setValidationError,
            handleAddPallet,
            handleAddProject,
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
            setPageSize,
        },
    };
};
