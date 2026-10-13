import {useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import type {OperatorReport} from '@backend/shared/types';
import {useAuth} from '../auth/AuthContext';
import {useTranslation} from '../i18n/LanguageContext';
import {getErrorMessage} from '../lib/errors';
import {SelectField, TextareaField} from './FormFields';

export function OperatorReports({palletId}: {palletId: string}) {
    const {apiClient} = useAuth();
    const {t, language} = useTranslation();
    const cache = useQueryClient();
    const query = useQuery({queryKey: ['operator-reports', palletId], queryFn: () => apiClient.pallet.GetOperatorReports({pallet_id: palletId})});
    const defects = useQuery({queryKey: ['defects'], queryFn: () => apiClient.pallet.GetDefects()});
    const [editing, setEditing] = useState<OperatorReport | null>(null);
    const [selected, setSelected] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    function open(report: OperatorReport) {
        setEditing(report); setDescription(report.description); setError('');
        setSelected(report.kind === 'washing' ? 'washing' : report.defect_id !== null && defects.data?.defects.some(d => d.id === report.defect_id)
            ? String(report.defect_id) : report.defect_name === 'Other' ? 'other' : 'saved');
    }
    async function save() {
        if (!editing || busy) return;
        setBusy(true); setError('');
        try {
            await apiClient.pallet.EditOperatorReport(editing.id, {
                pallet_id: palletId, version: editing.version, description: description.trim(),
                ...(selected === 'saved' || selected === 'washing' ? {} : {defect_id: selected === 'other' ? null : Number(selected)}),
                acceptLanguage: language,
            });
            setEditing(null);
            await Promise.all([cache.invalidateQueries({queryKey: ['operator-reports', palletId]}), cache.invalidateQueries({queryKey: ['pallets']}), cache.invalidateQueries({queryKey: ['reports']})]);
        } catch (e) {
            setError(getErrorMessage(e, t('catalog_error')));
            await cache.invalidateQueries({queryKey: ['operator-reports', palletId]});
        } finally {setBusy(false);}
    }
    return <section className="space-y-3 rounded-xl border border-brand-border bg-brand-bg/50 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-accent">{t('reports_open')}</h3>
        {query.isPending && <p role="status">{t('features_loading')}</p>}
        {query.isError && <p role="alert" className="text-red-300">{getErrorMessage(query.error, t('catalog_error'))}</p>}
        {query.data?.reports.length === 0 && <p className="text-sm text-brand-text-muted">{t('report_empty')}</p>}
        {query.data?.reports.map(report => <article key={report.id} className="border-t border-brand-border pt-3 space-y-2">
            <p className="text-sm font-bold text-brand-text">{report.kind === 'washing' ? t('op_washing_required') : report.defect_name === 'Other' ? t('op_other_fault_type') : report.defect_name}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-brand-text-muted">{report.description}</p>
            <p className="text-xs text-brand-text-muted">{report.operator_id} · {new Date(report.created_at).toLocaleString(language, {timeZone: 'Europe/Warsaw'})}</p>
            {report.edited_at && <p className="text-xs text-brand-text-muted">{t('report_edited')}: {report.edited_by} · {new Date(report.edited_at).toLocaleString(language, {timeZone: 'Europe/Warsaw'})}</p>}
            <button type="button" disabled={busy || defects.isPending} className="min-h-10 text-xs font-bold text-brand-accent" onClick={() => open(report)}>{t('report_edit')}</button>
        </article>)}
        {editing && <div className="space-y-3 rounded-xl border border-brand-accent/40 p-4">
            {editing.kind !== 'washing' && <SelectField label={t('defect_label')} disabled={busy} value={selected} onChange={e => setSelected(e.target.value)}>
                {selected === 'saved' && <option value="saved">{editing.defect_name} ({t('report_deleted_defect')})</option>}
                {defects.data?.defects.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                <option value="other">{t('op_other_fault_type')}</option>
            </SelectField>}
            <TextareaField label={t('report_description')} value={description} maxLength={2000} required={selected === 'other' || selected === 'washing'} disabled={busy} onChange={e => setDescription(e.target.value)}/>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex gap-3">
                <button type="button" disabled={busy || ((selected === 'other' || selected === 'washing') && !description.trim())} className="min-h-10 rounded-lg bg-brand-accent px-3 text-xs font-bold text-brand-bg disabled:opacity-50" onClick={() => void save()}>{t(busy ? 'saving' : 'report_save')}</button>
                <button type="button" disabled={busy} className="min-h-10 px-3 text-xs text-brand-text-muted" onClick={() => setEditing(null)}>{t('btn_cancel')}</button>
            </div>
        </div>}
    </section>;
}
