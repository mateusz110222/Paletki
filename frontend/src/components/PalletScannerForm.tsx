import type {FormEventHandler, Ref} from 'react';
import {ArrowRight, Scan} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';

export function PalletScannerForm({id, label, value, onChange, onSubmit, inputRef, busy, ready = true}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: FormEventHandler<HTMLFormElement>;
    inputRef: Ref<HTMLInputElement>;
    busy?: boolean;
    ready?: boolean;
}) {
    const {t} = useTranslation();
    return <form onSubmit={onSubmit}>
        <label htmlFor={id} className="mb-2 block text-xs font-semibold text-brand-text-muted">{label}</label>
        <div className="flex gap-2 rounded-xl border border-brand-border bg-brand-bg px-4 focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/10">
            <Scan size={21} aria-hidden="true" className="my-auto shrink-0 text-brand-accent"/>
            <input id={id} ref={inputRef} value={value} onChange={event => onChange(event.target.value.toUpperCase())}
                disabled={busy} autoComplete="off" spellCheck={false} placeholder={t('op_scan_placeholder')}
                className="min-w-0 flex-1 bg-transparent py-3 font-mono text-base font-bold uppercase text-brand-text outline-none"/>
            <button type="submit" disabled={!value.trim() || busy || !ready} aria-label={t('washing_scan_button')}
                className="my-2 rounded-lg px-3 text-brand-accent hover:bg-brand-accent/10 disabled:opacity-30">
                <ArrowRight size={20} aria-hidden="true"/>
            </button>
        </div>
    </form>;
}
