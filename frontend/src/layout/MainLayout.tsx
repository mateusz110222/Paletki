import React from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import {useAuth} from '../auth/AuthContext.tsx';
import {LanguageSwitcher, useTranslation} from '../i18n/LanguageContext.tsx';
import {Sidebar} from './Sidebar.tsx';
import {UserCheck} from 'lucide-react';

export const MainLayout: React.FC = () => {
    const {user, isGuest, hasITDepartmentAccess, logout} = useAuth();
    const {t} = useTranslation();
    const location = useLocation();

    const getPageTitle = (pathname: string) => {
        switch (pathname) {
            case '/admin':
                return {title: t('panel_admin_title'), sub: t('panel_admin_subtitle')};
            case '/operator':
                return {title: t('panel_operator_title'), sub: t('panel_operator_subtitle')};
            case '/maintenance':
                return {title: t('panel_maint_title'), sub: t('panel_maint_subtitle')};
            case '/live':
                return {title: t('panel_live_title'), sub: t('panel_live_subtitle')};
            default:
                return {title: '', sub: ''};
        }
    };

    const {title, sub} = getPageTitle(location.pathname);

    return (
        <div
            className="flex flex-col md:flex-row min-h-screen bg-brand-bg text-brand-text font-sans selection:bg-brand-accent selection:text-brand-bg">
            <Sidebar hasITDepartmentAccess={hasITDepartmentAccess} onLogout={logout}/>

            <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-w-[1600px] mx-auto w-full">
                {/* Top Header */}
                <div
                    className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-brand-border/50">
                    <div>
                        <h2 className="text-2xl font-extrabold text-brand-text">{title}</h2>
                        <p className="text-xs text-brand-text-muted mt-1 font-medium">{sub}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <LanguageSwitcher/>
                        {user && (
                            <div
                                className="flex items-center gap-3 bg-brand-surface border border-brand-border px-4 py-2 rounded-xl">
                                <div
                                    className="w-8 h-8 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-brand-accent font-bold text-xs">
                                    <UserCheck size={16}/>
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-black text-brand-text leading-tight">
                                        {isGuest ? t('guest_name') : user.FullName}
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
                <Outlet/>
            </main>
        </div>
    );
};
