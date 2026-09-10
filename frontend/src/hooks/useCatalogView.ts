import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {getErrorMessage} from '../lib/errors';
import {useEscapeKey} from './useEscapeKey';
import {getCatalogEntries, type CatalogEntry as Entry} from '../lib/catalog';

export function useCatalogView() {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const cache = useQueryClient();
    const [tab, setTab] = useState<'project' | 'model'>('project');
    const [search, setSearch] = useState('');
    const [projectId, setProjectId] = useState<number | null>(null);
    const [selected, setSelected] = useState<{entry: Entry; remove: boolean; create?: boolean} | null>(null);
    const [name, setName] = useState('');
    const [projectName, setProjectName] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const runningRef = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const close = () => {if (!runningRef.current) setSelected(null);};
    useEscapeKey(Boolean(selected), close);
    const modalOpen = Boolean(selected);
    useEffect(() => {
        if (!modalOpen) return;
        const previous = document.activeElement as HTMLElement | null;
        (dialogRef.current?.querySelector<HTMLElement>('input, select') ?? dialogRef.current?.querySelector<HTMLElement>('button'))?.focus();
        return () => previous?.focus();
    }, [modalOpen]);
    const projects = useQuery({queryKey: ['projects', language], queryFn: () => apiClient.pallet.GetAllProjects()});
    const models = useQuery({queryKey: ['models', language], queryFn: () => apiClient.pallet.GetAllModels()});
    const entries = getCatalogEntries(
        projects.data?.projects ?? [], models.data?.models ?? [], tab, search, projectId,
    );
    const filteredProject = projects.data?.projects.find(project => project.id === projectId);

    function changeTab(kind: 'project' | 'model') {
        setTab(kind);
        setSelected(null);
        setSearch('');
        setProjectId(null);
    }

    function showProjectModels(id: number) {
        setTab('model');
        setSearch('');
        setProjectId(id);
    }

    async function save() {
        if (!selected || runningRef.current) return;
        runningRef.current = true;
        setBusy(true);
        setError('');
        setSuccess(false);
        try {
            if (selected.create) {
                if (selected.entry.kind === 'project') await apiClient.pallet.AddProject({name: name.trim(), acceptLanguage: language});
                else await apiClient.pallet.AddModel({name: name.trim(), project: projectName, acceptLanguage: language});
            } else if (selected.remove) {
                if (selected.entry.kind === 'project') await apiClient.pallet.DeleteProject(selected.entry.id, {acceptLanguage: language});
                else await apiClient.pallet.DeleteModel(selected.entry.id, {acceptLanguage: language});
            } else {
                if (selected.entry.kind === 'project') await apiClient.pallet.UpdateProject(selected.entry.id, {name: name.trim(), acceptLanguage: language});
                else await apiClient.pallet.UpdateModel(selected.entry.id, {name: name.trim(), acceptLanguage: language});
            }
            setSelected(null);
            setSuccess(true);
            await Promise.all([cache.invalidateQueries({queryKey: ['projects']}), cache.invalidateQueries({queryKey: ['models']}), cache.invalidateQueries({queryKey: ['pallets']})]);
        } catch (err) {
            setError(getErrorMessage(err, t('catalog_error')));
        } finally {
            runningRef.current = false;
            setBusy(false);
        }
    }

    function select(entry: Entry, remove: boolean) {
        setSelected({entry, remove});
        setName(entry.name);
        setError('');
        setSuccess(false);
    }

    function add(kind: 'project' | 'model') {
        setSelected({entry: {id: 0, kind, name: ''}, remove: false, create: true});
        setName('');
        setProjectName('');
        setError('');
        setSuccess(false);
    }
    const modalTitle = selected?.create
        ? t(selected.entry.kind === 'project' ? 'modal_add_project_title' : 'modal_add_model_title')
        : t(selected?.remove ? 'catalog_delete' : 'catalog_edit');
    const projectModels = (id: number) => (models.data?.models ?? []).filter(model => model.project_id === id);

    function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key !== 'Tab') return;
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
        if (!controls?.length) {event.preventDefault(); return;}
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
                    
    }

    return {
        t, tab, search, setSearch, selected, name, setName, projectName, setProjectName,
        dialogRef, busy, error, success, close, projects, models, entries, save, select,
        add, modalTitle, projectModels, changeTab, showProjectModels, filteredProject,
        clearProjectFilter: () => setProjectId(null), handleDialogKeyDown,
        refresh: () => {void projects.refetch(); void models.refetch();},
    };
}
