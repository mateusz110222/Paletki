import {ArrowLeft} from 'lucide-react';
import {Link} from 'react-router';
import {DefectCatalog} from '../components/DefectCatalog';
import {useTranslation} from '../i18n/LanguageContext';

export function DefectCatalogView() {
    const {t} = useTranslation();
    return <div className="mx-auto max-w-5xl space-y-5">
        <Link to="/maintenance" className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-brand-text-muted hover:text-brand-accent"><ArrowLeft size={15}/>{t('maintenance_back')}</Link>
        <DefectCatalog/>
    </div>;
}
