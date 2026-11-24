import {ClipboardList, Wrench, Scan, History} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';
import {PanelChoiceCard} from '../components/PanelChoiceCard';

export function MaintenanceHubView() {
    const {t} = useTranslation();
    return <section className="@container mx-auto w-full max-w-5xl space-y-6">
        <div className="grid gap-[clamp(0.75rem,2vh,1.25rem)] @min-[43rem]:grid-cols-2">
            <PanelChoiceCard to="/maintenance/service" title={t('maintenance_service_title')}
                eyebrow={t('maintenance_service_eyebrow')} description={t('maintenance_service_description')} icon={Wrench}/>
            <PanelChoiceCard to="/maintenance/washing" title={t('washing_scanner_title')}
                eyebrow={t('washing_scanner_eyebrow')} description={t('washing_scanner_intro')} icon={Scan} tone="teal"/>
            <PanelChoiceCard to="/maintenance/defects" title={t('defects_title')}
                eyebrow={t('maintenance_defects_eyebrow')} description={t('maintenance_defects_description')} icon={ClipboardList} tone="teal"/>
            <PanelChoiceCard to="/maintenance/history" title={t('maintenance_history_title')}
                eyebrow={t('maintenance_history_eyebrow')} description={t('maintenance_history_description')} icon={History}/>
        </div>
    </section>;
}
