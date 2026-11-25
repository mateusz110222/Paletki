import {Search} from "lucide-react";
import React, {useId} from "react";
import {useSearchParams} from "react-router";
import {useTranslation} from "../i18n/LanguageContext.tsx";

export function SearchInput() {
    const {t} = useTranslation();
    const searchInputId = useId();
    const [searchParams, setSearchParams] = useSearchParams();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSearchTerm = e.target.value;
        const newParams = new URLSearchParams(searchParams);
        if (newSearchTerm) {
            newParams.set('searchTerm', newSearchTerm);
        } else {
            newParams.delete('searchTerm');
        }
        setSearchParams(newParams, {replace: true});
    };

    return (
        <div className="flex items-center gap-2 bg-brand-surface border border-brand-border h-12 px-3 rounded">
            <label htmlFor={searchInputId} className="sr-only">{t('search_label')}</label>
            <Search className="text-brand-text-muted" size={18} aria-hidden="true"/>
            <input
                id={searchInputId}
                type="text"
                aria-label={t('search_label')}
                placeholder={t('btn_search_placeholder')}
                value={searchParams.get('searchTerm') ?? ''}
                onChange={handleChange}
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm w-full placeholder:text-brand-text-muted"
            />
        </div>
    );
}
