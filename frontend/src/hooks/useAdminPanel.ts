import React, {useState} from 'react';
import {Pallet, PalletStatus, Project} from '@backend/shared/types';
import {useTranslation} from '../i18n/LanguageContext.tsx';
import {useAuth} from "../auth/AuthContext.tsx";
import {useGlobalErrorModal} from "./useGlobalErrorModal.ts";
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";

interface UseAdminPanelProps {
    pallets: Pallet[];
    projects: Project[] | string[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
    setProjects: React.Dispatch<React.SetStateAction<any>>;
}

export const useAdminPanel = ({
                                  pallets,
                                  projects,
                                  setPallets,
                                  setProjects,
                              }: UseAdminPanelProps) => {
    const {t, language} = useTranslation();
    const {user: {FullName: Operator}} = useAuth();
    const {errorModalState, showGlobalError, hideGlobalError} = useGlobalErrorModal();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProject, setSelectedProject] = useState('ALL');
    const [selectedModel, setSelectedModel] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');

// Modals state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
    const [isBlockOpen, setIsBlockOpen] = useState(false);
    const [selectedPalletForBlock, setSelectedPalletForBlock] = useState<Pallet | null>(null);
    const [selectedPalletForAudit, setSelectedPalletForAudit] = useState<Pallet | null>(null);

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

// Error & Status handling
    const [validationError, setValidationError] = useState('');
    const [blockError, setBlockError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

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

    const totalPallets = pallets.length;
    const availableStock = pallets.filter((p) => p.status === 'Active').length;
    const blockedOrMaint = pallets.filter((p) => ['Blocked', 'Washing_Required', 'Damaged'].includes(p.status)).length;
    const avaliblePalletes_Percenetege = Math.min(100,Math.round((availableStock / totalPallets) * 100))


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
        } catch (error: any) {
            console.error("Failed to fetch pallets:", error);
            showGlobalError(t('error_fetching_pallets_title'), error.message || t('error_connecting_to_encore'));
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

    const handleAddPallet = async (e: React.FormEvent) => {
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
                status: "NEW",
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
        } catch (error: any) {
            console.error('Error adding pallet:', error);
            setValidationError(error.message || t('error_connecting_to_encore'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddProject = async (e: React.FormEvent) => {
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
        } catch (error: any) {
            console.error('Error adding project:', error);
            setValidationError(error.message || t('error_connecting_to_encore'));
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

    const handleConfirmBlock = async (e: React.FormEvent) => {
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
        } catch (err: any) {
            console.error('Error blocking pallet:', err);
            setBlockError(err.message || t('error_connecting_to_encore'));
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
        } catch (err: any) {
            console.error('Error unblocking pallet:', err);
            showGlobalError(t('error_unblocking_pallet_title'), err.message || t('error_connecting_to_encore'));
        }
    };

    const handleDeletePallet = async (palletId: string) => {
        if (!window.confirm(t('delete_pallet_confirm'))) return;

        try {
            const response = await fetch(`${API_BASE_URL}/pallets/${palletId}`, {
                method: "DELETE",
                headers: { "Accept-Language": language },
            });

            const resData = await response.json().catch(() => ({}));

            if (!response.ok) {
                showGlobalError(t('error_deleting_pallet_title'), resData.message || t('error_connecting_to_encore'));
                return;
            }

            fetchPallets();
        } catch (err: any) {
            console.error('Error deleting pallet:', err);
            showGlobalError(t('error_deleting_pallet_title'), err.message || t('error_connecting_to_encore'));
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

        } catch (err: any) {
            console.error("Błąd pobierania historii audytowej:", err);
            showGlobalError(t('error_fetching_audit_history_title'), err.message || t('failed_to_fetch_history'));
        }
    };

    const handleRefreshPallets = async () => {
        setIsRefreshing(true);
        await fetchPallets();
        setTimeout(() => setIsRefreshing(false), 400);
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
            selectedPalletForBlock,
            blockReason,
            selectedPalletForAudit,
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
            avaliblePalletes_Percenetege
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
            setNewProjectName,
            setIsBlockOpen: (open: boolean) => {
                setBlockError('');
                setIsBlockOpen(open);
            },
            setSelectedPalletForBlock,
            setBlockReason,
            setSelectedPalletForAudit,
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
            handleExportAuditTrail,
            handleRefreshPallets,
            showGlobalError, // Expose showGlobalError
            hideGlobalError, // Expose hideGlobalError
        },
    }
}
