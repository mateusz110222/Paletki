import {useEffect} from 'react';
import {Language} from '../i18n/LanguageContext.tsx';

export function useDocumentMetadata(title: string, description: string, language: Language): void {
    useEffect(() => {
        document.title = title;
        document.documentElement.lang = language;
        document.querySelector<HTMLMetaElement>('meta[name="description"]')
            ?.setAttribute('content', description);
    }, [description, language, title]);
}
