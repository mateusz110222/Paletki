import {useEffect, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {FolderTree, Folder, Layers3, Search, ArrowRight, Info, CheckCircle2, Pencil, Trash2, PlusCircle, X} from 'lucide-react';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {InputField, SelectField} from '../components/FormFields';
import {getErrorMessage} from '../lib/errors';

import {ModalPresence, ModalTransition} from '../components/ModalTransition';
import {ModalFormActions} from '../components/ModalFormActions';
import {useEscapeKey} from '../hooks/useEscapeKey';

type Entry = {id: number; kind: 'project' | 'model'; name: string; project?: string};

export function CatalogView() {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const cache = useQueryClient();
    const [tab, setTab] = useState<'project' | 'model'>('project');
    const [search, setSearch] = useState('');
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
    const query = search.trim().toLocaleLowerCase();
    const entries: Entry[] = (projects.data?.projects ?? []).flatMap(project => {
        const children: Entry[] = (models.data?.models ?? []).filter(model => model.project_id === project.id)
            .map(model => ({id: model.id, kind: 'model', name: model.name, project: project.name}));
        return [{id: project.id, kind: 'project', name: project.name} as Entry, ...children];
    }).filter(entry => entry.kind === tab).filter(entry => `${entry.name} ${entry.project ?? ''}`.toLocaleLowerCase().includes(query));

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
    const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold hover:bg-brand-surface-high disabled:opacity-40';
    const projectModels = (id: number) => (models.data?.models ?? []).filter(model => model.project_id === id);
    return <div className="space-y-4 animate-in fade-in duration-300">
        <section className="overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-surface">
            <div className="flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/10 text-indigo-300"><FolderTree size={23}/></div>
                    <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-text-muted/70">{t('catalog_eyebrow')}</p>
                        <h3 className="text-lg font-extrabold tracking-tight">{t('catalog_heading')}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-brand-text-muted/80">{t('catalog_intro')}</p>
                    </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row xl:shrink-0">
                    <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 text-xs font-bold text-white transition hover:brightness-110" onClick={() => add('project')}><PlusCircle size={16}/>{t('btn_add_project')}</button>
                    <button className={buttonClass + ' min-h-11 px-4'} onClick={() => add('model')} disabled={projects.isPending || projects.isError || !projects.data?.projects.length}><PlusCircle size={16}/>{t('btn_add_model')}</button>
                </div>
            </div>
            <div className="flex flex-col gap-4 border-t border-brand-border/60 bg-brand-bg/25 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex self-start rounded-lg border border-brand-border/70 bg-brand-bg/60 p-1" role="group" aria-label={t('nav_catalog')}>
                    {(['project', 'model'] as const).map(kind => <button key={kind} type="button" aria-pressed={tab === kind}
                        aria-label={t(kind === 'project' ? 'catalog_projects' : 'catalog_models')}
                        className={'inline-flex min-h-10 items-center gap-2 rounded-md px-3 sm:px-4 text-xs font-bold transition-colors ' + (tab === kind ? ' bg-brand-surface-high text-white shadow-sm' : ' text-brand-text-muted/70 hover:text-white')}
                        onClick={() => {setTab(kind); setSelected(null); setSearch('');}} disabled={busy}>
                        {kind === 'project' ? <Folder size={15}/> : <Layers3 size={15}/>}
                        {t(kind === 'project' ? 'catalog_projects' : 'catalog_models')}
                        <span className={'ml-1 rounded px-1.5 py-0.5 text-[10px] font-mono ' + (tab === kind ? ' bg-brand-accent/20 text-indigo-200' : ' bg-brand-surface text-brand-text-muted')}>
                            {(kind === 'project' ? projects.data?.projects.length : models.data?.models.length) ?? '—'}
                        </span>
                    </button>)}
                </div>
                <div className="flex h-11 items-center gap-2 rounded-lg border border-brand-border/70 bg-brand-bg/60 px-3 transition focus-within:border-brand-accent lg:w-80">
                    <Search size={16} className="shrink-0 text-brand-text-muted/60"/>
                    <input aria-label={t('catalog_search')} placeholder={t('catalog_search')} value={search} onChange={event => setSearch(event.target.value)} type="search"
                        className="min-w-0 w-full bg-transparent text-xs outline-none placeholder:text-brand-text-muted/50"/>
                </div>
            </div>
        </section>
        {success && <p role="status" className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={16}/>{t('catalog_saved')}</p>}
        <ModalPresence>
            {selected && <ModalTransition onBackdropClick={close}>
                <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title"
                    className="relative bg-brand-surface border border-brand-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
                    onKeyDown={event => {
                        if (event.key !== 'Tab') return;
                        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
                        if (!controls?.length) {event.preventDefault(); return;}
                        const first = controls[0], last = controls[controls.length - 1];
                        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
                        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
                    }}>
                    <div className="bg-brand-surface-high p-5 border-b border-brand-border flex justify-between items-center">
                        <h3 id="catalog-modal-title" className="text-base font-bold uppercase tracking-wider flex items-center gap-2">
                            {selected.remove ? <Trash2 size={18} className="text-red-400"/> : selected.create ? <PlusCircle size={18} className="text-brand-accent"/> : <Pencil size={18} className="text-brand-accent"/>}
                            {modalTitle}
                        </h3>
                        <button type="button" disabled={busy} aria-label={t('btn_cancel')} onClick={close} className="text-brand-text-muted hover:text-red-400"><X size={18}/></button>
                    </div>
                    <form onSubmit={event => {event.preventDefault(); void save();}} className="p-6 space-y-4">
                        {!selected.create && <p className="font-bold break-words">{selected.entry.project ? selected.entry.project + ' / ' : ''}{selected.entry.name}</p>}
                        {selected.create && selected.entry.kind === 'model' && <SelectField label={t('label_model_project')} value={projectName}
                            onChange={event => setProjectName(event.target.value)} required disabled={busy}>
                            <option value="">{t('placeholder_select_project')}</option>
                            {(projects.data?.projects ?? []).map(project => <option key={project.id} value={project.name}>{project.name}</option>)}
                        </SelectField>}
                        {selected.remove ? <p>{t('catalog_confirm')}</p> : <InputField
                            label={t(selected.entry.kind === 'project' ? 'label_project_name' : 'label_model_name')}
                            value={name} onChange={event => setName(event.target.value)} maxLength={50} required disabled={busy}/>}
                        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
                        <ModalFormActions onCancel={close} submitLabel={t(selected.remove ? 'catalog_delete' : 'btn_save')}
                            isSubmitting={busy} variant={selected.remove ? 'danger' : 'primary'}
                            submitDisabled={!selected.remove && (!name.trim() || Boolean(selected.create && selected.entry.kind === 'model' && !projectName))}/>
                    </form>
                </div>
            </ModalTransition>}
        </ModalPresence>
        {projects.isPending || models.isPending ? <p role="status">{t('catalog_loading')}</p>
            : projects.isError || models.isError ? <div role="alert" className="space-y-3 text-red-400">
                <p>{t('fetch_error_banner')}</p><button className={buttonClass} onClick={() => {void projects.refetch(); void models.refetch();}}>{t('btn_refresh_pallets')}</button>
            </div> : <section className="overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-surface">
                <table className="w-full text-sm text-left">
                    <thead className="border-b border-brand-border/60 bg-brand-bg/30 text-[10px] uppercase tracking-widest text-brand-text-muted/70"><tr>
                        <th scope="col" className="px-5 py-4 sm:px-6">{t(tab === 'project' ? 'col_project' : 'col_model')}</th>
                        <th scope="col" className="hidden px-5 py-4 sm:table-cell">{t(tab === 'project' ? 'catalog_linked_models' : 'col_project')}</th>
                        <th scope="col" className="px-5 py-4 text-right sm:px-6">{t('col_actions')}</th>
                    </tr></thead>
                    <tbody className="divide-y divide-brand-border/50">{entries.map(entry => {
                        const children = entry.kind === 'project' ? projectModels(entry.id) : [];
                        return <tr key={entry.kind + '-' + entry.id} className="group transition-colors hover:bg-brand-surface-high/35">
                            <td className="px-5 py-5 sm:px-6">
                                <div className="flex items-center gap-3">
                                    <div className="hidden size-10 shrink-0 items-center justify-center rounded-lg border border-brand-border/60 bg-brand-bg/40 text-indigo-300 sm:flex">
                                        {entry.kind === 'project' ? <Folder size={18}/> : <Layers3 size={18}/>}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="font-bold break-all">{entry.name}</span>
                                        <p className="mt-1 text-[11px] text-brand-text-muted/60">{entry.kind === 'project' ? t('catalog_project_record') : entry.project}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="hidden px-5 py-5 sm:table-cell">
                                {entry.kind === 'project' ? <button type="button" onClick={() => {setTab('model'); setSearch(entry.name);}}
                                    className="group/models inline-flex items-center gap-3 rounded-lg py-1 text-xs text-brand-text-muted hover:text-indigo-200"
                                    aria-label={t('catalog_view_models') + ': ' + entry.name}>
                                    <span className="flex size-8 items-center justify-center rounded-lg border border-brand-border/60 bg-brand-bg/40 font-mono text-indigo-200">{children.length}</span>
                                    <span className="max-w-64 truncate">{children.length ? children.map(model => model.name).join(', ') : t('catalog_no_models')}</span>
                                    <ArrowRight size={14} className="text-brand-text-muted/50 transition-transform group-hover/models:translate-x-1"/>
                                </button> : <span className="inline-flex items-center gap-2 rounded-md border border-brand-border/60 bg-brand-bg/30 px-2.5 py-1.5 text-xs text-brand-text-muted"><Folder size={13}/>{entry.project}</span>}
                            </td>
                            <td className="px-5 py-5 sm:px-6"><div className="flex justify-end gap-2">
                                <button className={buttonClass + ' min-h-10'} disabled={busy} onClick={() => select(entry, false)} aria-label={t('catalog_edit') + ': ' + (entry.project ?? '') + ' ' + entry.name} title={t('catalog_edit')}><Pencil size={14}/><span className="hidden md:inline">{t('catalog_edit')}</span></button>
                                <button className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-brand-text-muted/60 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40" disabled={busy} onClick={() => select(entry, true)} aria-label={t('catalog_delete') + ': ' + (entry.project ?? '') + ' ' + entry.name} title={t('catalog_delete')}><Trash2 size={15}/></button>
                            </div></td>
                        </tr>;
                    })}</tbody>
                </table>
                {!entries.length && <div className="px-6 py-14 text-center"><Search size={28} className="mx-auto mb-3 text-brand-text-muted/40"/><p className="text-sm text-brand-text-muted">{t('catalog_empty')}</p></div>}
                <div className="flex items-start gap-2 border-t border-brand-border/50 bg-brand-bg/20 px-5 py-4 sm:px-6">
                    <Info size={14} className="mt-0.5 shrink-0 text-brand-text-muted/50"/>
                    <p className="text-[11px] leading-relaxed text-brand-text-muted/60">{t('catalog_hint')}</p>
                </div>
            </section>}

    </div>;
}
