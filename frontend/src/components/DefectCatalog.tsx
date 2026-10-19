import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Plus, Trash2, Pencil, X, ClipboardList, Search} from 'lucide-react';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {ModalPresence, ModalTransition} from './ModalTransition';
import {ModalFormActions} from './ModalFormActions';
import {useEscapeKey} from '../hooks/useEscapeKey';
import {InputField} from './FormFields';
import {getErrorMessage} from '../lib/errors';
import {invalidateAndBroadcast} from '../lib/queryCache';

export function DefectCatalog() {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const cache = useQueryClient();
    const query = useQuery({queryKey: ['defects'], queryFn: () => apiClient.pallet.GetDefects()});
    const [search, setSearch] = useState('');
    const [name, setName] = useState('');
    const [selected, setSelected] = useState<{mode: 'add' | 'edit' | 'delete'; id?: number; name: string} | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const runningRef = useRef(false);
    const modalOpen = selected !== null;
    const close = () => {if (!runningRef.current) setSelected(null);};
    useEscapeKey(modalOpen, close);
    useEffect(() => {
        if (!modalOpen) return;
        const previous = document.activeElement as HTMLElement | null;
        (dialogRef.current?.querySelector<HTMLElement>('input') ?? dialogRef.current?.querySelector<HTMLElement>('button'))?.focus();
        return () => previous?.focus();
    }, [modalOpen]);
    function open(mode: 'add' | 'edit' | 'delete', defect?: {id: number; name: string}) {
        setError(''); setName(defect?.name ?? ''); setSelected({mode, id: defect?.id, name: defect?.name ?? ''});
    }
    function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key !== 'Tab') return;
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    }
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    async function save() {
        if (!selected || runningRef.current || (selected.mode !== 'delete' && !name.trim())) return;
        runningRef.current = true; setBusy(true); setError('');
        try {
            if (selected.mode === 'add') await apiClient.pallet.AddDefect({name: name.trim(), acceptLanguage: language});
            else if (selected.mode === 'edit') await apiClient.pallet.UpdateDefect(selected.id!, {name: name.trim(), acceptLanguage: language});
            else await apiClient.pallet.DeleteDefect(selected.id!, {acceptLanguage: language});
            await invalidateAndBroadcast(cache, [['defects']]);
            setSelected(null);
        } catch (e) {setError(getErrorMessage(e, t('catalog_error')));}
        finally {runningRef.current = false; setBusy(false);}
    }
    const visibleDefects = (query.data?.defects ?? []).filter(defect => defect.name.toLocaleLowerCase(language).includes(search.trim().toLocaleLowerCase(language)));
    return <div className="space-y-5">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border p-5">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-text-muted">{t('defects_count')}</p><h2 className="mt-1 text-lg font-black text-brand-text">{t('defects_title')} <span className="ml-2 rounded-md border border-brand-border bg-brand-bg px-2 py-1 font-mono text-xs text-brand-accent">{query.data?.defects.length ?? 0}</span></h2></div>
                <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={() => open('add')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 text-xs font-black text-brand-bg transition-colors hover:brightness-110 disabled:opacity-40"><Plus size={16}/>{t('defect_add')}</button><label className="flex min-h-10 items-center gap-2 rounded-xl border border-brand-border bg-brand-bg px-3 text-brand-text-muted"><Search size={15}/><input type="search" aria-label={t('defect_name')} placeholder={t('defect_name')} value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 max-w-48 bg-transparent text-xs text-brand-text outline-none"/></label></div>
            </header>
            {query.isError && <p role="alert" className="p-5 text-sm text-red-300">{getErrorMessage(query.error, t('defects_load_error'))}</p>}
            {query.isPending && <p role="status" className="p-5 text-sm text-brand-text-muted">{t('features_loading')}</p>}
            {!query.isPending && !query.isError && visibleDefects.length === 0 && <div className="px-6 py-14 text-center"><ClipboardList size={28} className="mx-auto mb-3 text-brand-text-muted/40"/><p className="text-sm text-brand-text-muted">{query.data?.defects.length ? t('history_no_results') : t('defects_empty')}</p></div>}
            <ul className="divide-y divide-brand-border/70">
                {visibleDefects.map((defect, index) => <li key={defect.id} className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors ${selected?.id === defect.id ? 'bg-brand-accent/5' : 'hover:bg-brand-surface-high/30'}`}>
                    <div className="flex min-w-0 items-center gap-4"><span className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 font-mono text-xs text-brand-text-muted">{String(index+1).padStart(2,'0')}</span><span className="break-words text-sm font-bold text-brand-text">{defect.name}</span></div>
                    <div className="flex shrink-0 gap-1.5">
                        <button type="button" disabled={busy} aria-label={`${t('catalog_edit')}: ${defect.name}`} className="rounded-lg border border-brand-border p-2.5 text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-accent disabled:opacity-40" onClick={() => open('edit', defect)}><Pencil size={15}/></button>
                        <button type="button" disabled={busy} aria-label={`${t('defect_delete')}: ${defect.name}`} className="rounded-lg border border-brand-border p-2.5 text-brand-text-muted transition-colors hover:border-red-400/40 hover:text-red-300 disabled:opacity-40" onClick={() => open('delete', defect)}><Trash2 size={15}/></button>
                    </div>
                </li>)}
            </ul>
        </section>
        <ModalPresence>{selected && <ModalTransition onBackdropClick={close}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="defect-modal-title" onKeyDown={handleDialogKeyDown} className="relative w-full max-w-lg overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-brand-border bg-brand-surface-high p-5">
                    <h3 id="defect-modal-title" className="flex items-center gap-2 text-base font-bold uppercase tracking-wider">
                        {selected.mode === 'delete' ? <Trash2 size={18} className="text-red-400"/> : selected.mode === 'add' ? <Plus size={18} className="text-brand-accent"/> : <Pencil size={18} className="text-brand-accent"/>}
                        {t(selected.mode === 'delete' ? 'defect_delete' : selected.mode === 'add' ? 'defect_add' : 'defects_editing')}
                    </h3>
                    <button type="button" disabled={busy} aria-label={t('btn_cancel')} onClick={close} className="rounded-lg p-1 text-brand-text-muted hover:text-red-400"><X size={18}/></button>
                </div>
                <form onSubmit={event => {event.preventDefault(); void save();}} className="space-y-5 p-6">
                    {selected.mode === 'delete' ? <><p className="break-words font-bold text-brand-text">{selected.name}</p><p className="text-sm leading-relaxed text-brand-text-muted">{t('defect_delete_confirm')}</p></> : <><p className="text-xs leading-relaxed text-brand-text-muted">{t('defects_add_intro')}</p><InputField label={t('defect_name')} value={name} maxLength={100} required disabled={busy} onChange={event => setName(event.target.value)}/></>}
                    {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-300">{error}</p>}
                    <ModalFormActions onCancel={close} submitLabel={t(selected.mode === 'delete' ? 'defect_delete' : selected.mode === 'add' ? 'defect_add' : 'btn_save')} isSubmitting={busy} variant={selected.mode === 'delete' ? 'danger' : 'primary'} submitDisabled={selected.mode !== 'delete' && !name.trim()}/>
                </form>
            </div>
        </ModalTransition>}</ModalPresence>
    </div>;
}
