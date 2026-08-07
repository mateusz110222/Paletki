import {Search} from "lucide-react";
import React from "react";
import {useTranslation} from "../i18n/LanguageContext.tsx";

interface SearchInputProps {
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    searchParams: URLSearchParams;
    setSearchParams: (params: URLSearchParams) => void;
}

export function SearchInput({searchTerm, onSearchTermChange, searchParams, setSearchParams}: SearchInputProps) {
    const {t} = useTranslation();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSearchTerm = e.target.value;
        onSearchTermChange(newSearchTerm);

        const newParams = new URLSearchParams(searchParams);
        if (newSearchTerm) {
            newParams.set('searchTerm', newSearchTerm);
        } else {
            newParams.delete('searchTerm');
        }
        setSearchParams(newParams);
    };

    return (
        <div className="flex items-center gap-2 bg-brand-surface border border-brand-border h-12 px-3 rounded">
            <Search className="text-brand-text-muted" size={18}/>
            <input
                type="text"
                placeholder={t('btn_search_placeholder')}
                value={searchTerm}
                onChange={handleChange}
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm w-full placeholder:text-brand-text-muted/60"
            />
        </div>
    );
}