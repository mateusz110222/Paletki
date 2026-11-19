import {ViewBoundary} from '../components/ViewBoundary';
import React, {useCallback, useState, type ReactNode} from 'react';
import {Link, Outlet, useLocation} from 'react-router';
import {useAuth} from '../auth/AuthContext.tsx';
import {LanguageSwitcher, useTranslation} from '../i18n/LanguageContext.tsx';
import {Sidebar} from './Sidebar.tsx';
import {ArrowLeft, Menu, UserCheck} from 'lucide-react';
import {useDocumentMetadata} from '../hooks/useDocumentMetadata.ts';

export const MainLayout: React.FC<{children?: ReactNode}> = ({children}) => {
    const {user, isGuest, hasITDepartmentAccess, canManagePallets, isMaintenanceOnly, canAccessMaintenance, canAccessLab, logout} = useAuth();
    const {t, language} = useTranslation();
    const location = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

    const getPageTitle = (pathname: string) => {
        if ((pathname.startsWith('/admin/pallets/') || pathname.startsWith('/maintenance/pallets/')) && pathname.endsWith('/history')) {
            return {
                title: t('history_page_title'),
                sub: t('history_page_subtitle'),
                back: pathname.startsWith('/maintenance/') ? {to: '/maintenance/history', label: t('history_back_to_lookup')} : undefined,
            };
        }
        const maintenanceBack = {to: '/maintenance', label: t('maintenance_back')};
        const labBack = {to: '/lab', label: t('lab_back')};
        switch (pathname) {
            case '/documentation':
                return {title: t('nav_documentation'), sub: t('documentation_subtitle')};
            case '/catalog':
                return {title: t('nav_catalog'), sub: t('catalog_subtitle')};
            case '/directory':
                return {title: t('directory_title'), sub: t('directory_subtitle')};
            case '/admin':
                return {title: t('panel_admin_title'), sub: t('panel_admin_subtitle')};
            case '/operator':
                return {title: t('panel_operator_title'), sub: t('panel_operator_subtitle')};
            case '/dashboards':
                return {title: t('nav_dashboards'), sub: t('dashboard_hub_intro')};
            case '/maintenance/service':
                return {title: t('maintenance_service_title'), sub: t('panel_maint_subtitle'), back: maintenanceBack};
            case '/maintenance/history':
                return {title: t('maintenance_history_title'), sub: t('maintenance_history_description'), back: maintenanceBack};
            case '/maintenance/washing':
                return {title: t('washing_scanner_title'), sub: t('washing_scanner_intro'), back: maintenanceBack};
            case '/maintenance/defects':
                return {title: t('defects_title'), sub: t('maintenance_defects_description'), back: maintenanceBack};
            case '/reports':
                return {title: t('reports_title'), sub: t('reports_intro')};
            case '/maintenance':
                return {title: t('maintenance_hub_title'), sub: t('maintenance_hub_intro')};
            case '/lab':
                return {title: 'LAB', sub: t('lab_subtitle')};
            case '/lab/table':
                return {title: 'LAB', sub: t('lab_table_title'), back: labBack};
            case '/lab/scan':
                return {title: 'LAB', sub: t('lab_scan_title'), back: labBack};
            case '/live':
                return {title: t('panel_live_title'), sub: t('panel_live_subtitle')};
            default:
                return {title: '', sub: ''};
        }
    };

    const {title, sub, back} = getPageTitle(location.pathname.replace(/\/+$/, ''));
    useDocumentMetadata(
        title ? `PalletX | ${title}` : 'PalletX',
        sub || t('app_meta_description'),
        language,
    );

    return (
        <div
            className="staff-screen flex flex-col lg:flex-row min-h-screen bg-brand-bg text-brand-text font-sans selection:bg-brand-accent selection:text-brand-bg">
            <Sidebar hasITDepartmentAccess={hasITDepartmentAccess} canManagePallets={canManagePallets} isMaintenanceOnly={isMaintenanceOnly}
                     canAccessMaintenance={canAccessMaintenance} canAccessLab={canAccessLab} onLogout={logout}
                     mobileOpen={mobileNavOpen} onMobileClose={closeMobileNav}/>

            <main className="staff-main min-w-0 flex-1 p-3 sm:p-5 xl:p-8 space-y-4 xl:space-y-6 w-full">
                {/* Top Header */}
                <div
                    className="flex flex-wrap justify-between items-center gap-3 pb-3 xl:pb-4 border-b border-brand-border/50">
                    <div className="flex items-start gap-3">
                        <button
                            type="button"
                            onClick={event => {
                                event.currentTarget.focus();
                                setMobileNavOpen(true);
                            }}
                            className="lg:hidden mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-accent transition-colors hover:bg-brand-surface-high"
                            aria-label={t('nav_open')}
                            aria-controls="mobile-navigation"
                            aria-expanded={mobileNavOpen}
                        >
                            <Menu size={22}/>
                        </button>
                        {back && <Link to={back.to} aria-label={back.label} title={back.label}
                            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text-muted transition-colors hover:border-brand-accent/50 hover:text-brand-accent focus-visible:outline-2 focus-visible:outline-brand-accent">
                            <ArrowLeft size={19} aria-hidden="true"/>
                        </Link>}
                        <div className="min-w-0">
                            <h2 className="text-xl xl:text-2xl font-extrabold text-brand-text">{title}</h2>
                            <p className="text-xs text-brand-text-muted mt-0.5 xl:mt-1 font-medium">{sub}</p>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-4">
                        <LanguageSwitcher/>
                        {user && (
                            <div
                                className="flex min-w-0 max-w-full items-center gap-3 bg-brand-surface border border-brand-border px-4 py-2 rounded-xl">
                                <div
                                    className="w-8 h-8 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-brand-accent font-bold text-xs">
                                    <UserCheck size={16}/>
                                </div>
                                <div className="min-w-0 break-words text-left">
                                    <p className="text-xs font-black text-brand-text leading-tight">
                                        {user.FullName}
                                    </p>
                                    <p className="text-[10px] text-brand-text-muted font-mono leading-tight">
                                        {isGuest ? t('guest_department') : user.department || ''}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dynamic Widoki (Admin, Operator, Maintenance, Live) */}
                <ViewBoundary>{children ?? <Outlet/>}</ViewBoundary>
            </main>
        </div>
    );
};
