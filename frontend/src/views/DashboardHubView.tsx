import {BarChart3, Tv} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';
import {useAuth} from '../auth/AuthContext';
import {MainLayout} from '../layout/MainLayout';
import {PanelChoiceCard} from '../components/PanelChoiceCard';

export function DashboardHubView() {
    const {t} = useTranslation();
    const {isAuthenticated} = useAuth();
    const content = <section className="mx-auto w-full max-w-5xl space-y-6">
        {!isAuthenticated && <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-brand-accent">PalletX</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-text">{t('dashboard_hub_title')}</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-text-muted">{t('dashboard_hub_intro')}</p></div>}
        <div className="grid gap-5 md:grid-cols-2">
            <PanelChoiceCard to="/live" title={t('dashboard_live_title')} description={t('dashboard_live_description')} eyebrow={t('dashboard_live_eyebrow')} icon={Tv}/>
            <PanelChoiceCard to="/dashboard" title={t('dashboard_operations_title')} description={t('dashboard_operations_description')} eyebrow={t('dashboard_operations_eyebrow')} icon={BarChart3} tone="teal"/>
        </div>
    </section>;
    return isAuthenticated ? <MainLayout>{content}</MainLayout> : <main className="min-h-dvh bg-brand-bg p-6 text-brand-text sm:p-12">{content}</main>;
}
