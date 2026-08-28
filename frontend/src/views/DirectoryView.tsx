import React, {useEffect, useRef, useState} from 'react';
import {AlertCircle, Building2, Loader2, Search, ShieldCheck, UserRound, UsersRound} from 'lucide-react';
import type {DirectoryUser} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {InputField} from '../components/FormFields';

export function DirectoryView() {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const [netId, setNetId] = useState('');
    const [result, setResult] = useState<DirectoryUser | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const requestRef = useRef<AbortController | null>(null);
    useEffect(() => () => requestRef.current?.abort(), []);

    async function search(event: React.SyntheticEvent<HTMLFormElement>) {
        event.preventDefault();
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setResult(null);
        setError('');
        try {
            const requestApi = apiClient.with({
                fetcher: (input, init) => fetch(input, {...init, signal: controller.signal}),
            });
            const data = await requestApi.auth.LookupDirectoryUser({
                net_id: netId.trim(),
                acceptLanguage: language,
            });
            if (controller.signal.aborted) return;
            setResult(data as DirectoryUser);
        } catch {
            if (!controller.signal.aborted) setError(t('directory_error'));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 md:p-7">
                <div className="flex items-center gap-2 text-brand-accent text-xs font-bold mb-5">
                    <ShieldCheck size={16}/>{t('directory_read_only')}
                </div>
                <form onSubmit={search} className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <InputField label={t('directory_netid')} value={netId} onChange={event => setNetId(event.target.value)}
                                fieldClassName="flex flex-col gap-2 flex-1" placeholder="matzielinski"
                                autoComplete="off" autoCapitalize="none" spellCheck={false}
                                maxLength={64} required aria-describedby="directory-hint"/>
                    <button type="submit" disabled={loading || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(netId.trim())}
                            className="min-h-11 px-5 rounded-xl bg-brand-accent text-brand-bg font-bold text-xs flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed">
                        {loading ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                        {t(loading ? 'directory_searching' : 'directory_search')}
                    </button>
                </form>
                <p id="directory-hint" className="text-xs text-brand-text-muted mt-3">{t('directory_hint')}</p>
            </section>

            {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                <AlertCircle size={18} className="shrink-0"/>{error}
            </div>}

            <div aria-live="polite" aria-busy={loading}>
                {loading ? <div role="status" className="flex items-center justify-center gap-3 py-20 text-brand-text-muted">
                    <Loader2 size={22} className="animate-spin"/>{t('directory_searching')}
                </div> : result ? (
                    <section className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden animate-in fade-in duration-300">
                        <div className="p-5 md:p-7 bg-brand-accent/5 border-b border-brand-border flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-brand-accent/15 text-brand-accent"><UserRound size={26}/></div>
                            <div className="min-w-0">
                                <h3 className="text-xl font-bold break-words">{result.full_name}</h3>
                                <p className="font-mono text-sm text-brand-accent mt-1">{result.net_id}</p>
                            </div>
                        </div>
                        <div className="p-5 md:p-7 space-y-6">
                            <dl className="grid md:grid-cols-2 gap-5">
                                <div className="rounded-xl border border-brand-border p-4">
                                    <dt className="flex items-center gap-2 text-xs text-brand-text-muted mb-2"><Building2 size={15}/>{t('directory_department')}</dt>
                                    <dd className="font-bold break-words">{result.department || t('directory_missing')}</dd>
                                </div>
                                <div className="rounded-xl border border-brand-border p-4">
                                    <dt className="text-xs text-brand-text-muted mb-2">{t('directory_job_title')}</dt>
                                    <dd className="font-medium break-words">{result.title || t('directory_missing')}</dd>
                                </div>
                            </dl>
                            <div className="rounded-xl bg-brand-bg p-4 space-y-2">
                                <h4 className="text-xs text-brand-text-muted">{t('directory_access')}</h4>
                                <p className="text-sm font-bold text-brand-accent">{t(result.has_it_department_access ? 'directory_it' : result.has_me_department_access ? 'directory_me' : result.has_ur_department_access ? 'directory_ur' : 'directory_operator')}</p>
                                <p className="text-xs text-brand-text-muted">{t('directory_access_hint')}</p>
                            </div>
                            <div>
                                <h4 className="flex items-center gap-2 font-bold"><UsersRound size={18}/>{t('directory_groups')}
                                    <span className="px-2 py-0.5 rounded bg-brand-accent/15 text-brand-accent text-xs">{result.groups.length}</span>
                                </h4>
                                <p className="text-xs text-brand-text-muted mt-2">{t('directory_groups_hint')}</p>
                                {!result.groups_complete && <p className="text-sm text-amber-400 mt-3">{t('directory_partial')}</p>}
                                {result.groups.length ? <ul className="mt-4 divide-y divide-brand-border rounded-xl border border-brand-border max-h-96 overflow-y-auto">
                                    {result.groups.map(group => <li key={group} className="px-4 py-3 text-xs font-mono break-all">{group}</li>)}
                                </ul> : <p className="mt-4 text-sm text-brand-text-muted">{t('directory_no_groups')}</p>}
                            </div>
                        </div>
                    </section>
                ) : !error && <div className="rounded-2xl border border-dashed border-brand-border px-6 py-16 text-center">
                    <UsersRound size={36} className="mx-auto text-brand-accent mb-4"/>
                    <h3 className="font-bold">{t('directory_empty')}</h3>
                    <p className="text-sm text-brand-text-muted max-w-lg mx-auto mt-2">{t('directory_empty_hint')}</p>
                </div>}
            </div>
        </div>
    );
}
