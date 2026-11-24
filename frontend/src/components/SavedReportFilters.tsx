import {useState} from 'react';
import {Bookmark, ChevronDown} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';
import {DeleteIcon, deleteActionClass} from './RecordActions';
import {InputField} from './FormFields';

type SavedFilter = {name: string; query: string};

export function parseSavedReportFilters(value: string | null): SavedFilter[] {
    try {
        const filters: unknown = JSON.parse(value ?? '[]');
        return Array.isArray(filters) ? filters.filter(filter =>
            typeof filter?.name === 'string' && Boolean(filter.name.trim()) && typeof filter.query === 'string') : [];
    } catch {
        return [];
    }
}

export function SavedReportFilters({username, query, disabled, onApply}: {
    username: string; query: string; disabled: boolean; onApply: (query: string) => void;
}) {
    const {t} = useTranslation();
    const key = 'palletx.report-filters.' + username;
    const [filters, setFilters] = useState(() => {
        try { return parseSavedReportFilters(localStorage.getItem(key)); } catch { return []; }
    });
    const [name, setName] = useState('');
    const [error, setError] = useState(false);

    function store(next: SavedFilter[]) {
        try {
            localStorage.setItem(key, JSON.stringify(next));
            setFilters(next);
            setError(false);
            return true;
        } catch {
            setError(true);
            return false;
        }
    }

    return <details className="group rounded-lg border border-brand-border bg-brand-bg/35">
        <summary className="flex min-h-11 list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <Bookmark size={16} aria-hidden="true"/>{t('reports_saved_filters')}
            <ChevronDown size={16} aria-hidden="true" className="ms-auto group-open:rotate-180"/>
        </summary>
        <div className="space-y-3 border-t border-brand-border p-3">
            {filters.length > 0 && <ul className="space-y-1">
                {filters.map(filter => <li key={filter.name} className="flex items-center gap-2">
                    <button type="button" disabled={disabled} onClick={() => onApply(filter.query)}
                        className="min-h-9 min-w-0 flex-1 wrap-anywhere rounded px-2 text-left text-sm font-semibold text-indigo-300 hover:bg-brand-surface-high">
                        {filter.name}
                    </button>
                    <button type="button" disabled={disabled} className={deleteActionClass}
                        aria-label={t('reports_delete_saved_filter', {name: filter.name})}
                        onClick={() => store(filters.filter(item => item.name !== filter.name))}>
                        <DeleteIcon size={16} aria-hidden="true"/>
                    </button>
                </li>)}
            </ul>}
            <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
                event.preventDefault();
                const trimmed = name.trim();
                if (!trimmed || !query || disabled) return;
                if (store([...filters.filter(item => item.name !== trimmed), {name: trimmed, query}])) setName('');
            }}>
                <InputField label={t('reports_saved_filter_name')} value={name} required maxLength={60}
                    disabled={disabled || !query} onChange={event => setName(event.target.value)} fieldClassName="min-w-40 flex flex-1 flex-col gap-1.5"/>
                <button type="submit" disabled={disabled || !query || !name.trim()}
                    className="min-h-11 rounded-lg border border-brand-border bg-brand-surface px-3 text-xs font-bold hover:border-brand-accent/50 disabled:opacity-40">
                    {t('reports_save_filter')}
                </button>
            </form>
            {error && <p role="alert" className="text-xs text-red-300">{t('reports_saved_filter_error')}</p>}
        </div>
    </details>;
}
