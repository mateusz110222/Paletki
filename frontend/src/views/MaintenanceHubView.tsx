import {ClipboardList, Wrench, Scan, History} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';
import {PanelChoiceCard} from '../components/PanelChoiceCard';

export function MaintenanceHubView() {
    const {t} = useTranslation();
    return <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
            <PanelChoiceCard to="/maintenance/service" title={t('maintenance_service_title')} description={t('maintenance_service_description')} eyebrow={t('maintenance_service_eyebrow')} icon={Wrench}/>
            <PanelChoiceCard to="/maintenance/washing" title={t('washing_scanner_title')} description={t('washing_scanner_intro')} eyebrow={t('washing_scanner_eyebrow')} icon={Scan} tone="teal"/>
            <PanelChoiceCard to="/maintenance/defects" title={t('defects_title')} description={t('maintenance_defects_description')} eyebrow={t('maintenance_defects_eyebrow')} icon={ClipboardList} tone="teal"/>
            <PanelChoiceCard to="/maintenance/history" title={t('maintenance_history_title')} description={t('maintenance_history_description')} eyebrow={t('maintenance_history_eyebrow')} icon={History}/>
        </div>
    </section>;
}
