import React from 'react';
import {NavLink} from 'react-router-dom';
import {BarChart3, LayoutDashboard, LogOut, LucideIcon, Scan, Tv, Wrench, UserSearch, X} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';

interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
}

interface SidebarProps {
    hasITDepartmentAccess: boolean;
    canManagePallets: boolean;
    isMaintenanceOnly: boolean;
    canAccessMaintenance: boolean;
    onLogout: () => void;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    hasITDepartmentAccess,
    canManagePallets,
    isMaintenanceOnly,
    canAccessMaintenance,
    onLogout,
    mobileOpen = false,
    onMobileClose = () => undefined,
}) => {
    const {t} = useTranslation();

    const navItems: NavItem[] = [
        ...(canManagePallets ? [{path: '/admin', label: t('nav_admin'), icon: LayoutDashboard}] : []),
        ...(!isMaintenanceOnly ? [{path: '/operator', label: t('nav_operator'), icon: Scan}] : []),
        ...(canAccessMaintenance ? [{path: '/maintenance', label: t('nav_maintenance'), icon: Wrench}] : []),
        {path: '/live', label: t('nav_live'), icon: Tv},
        {path: '/dashboard', label: t('nav_public_dashboard'), icon: BarChart3},
        ...(hasITDepartmentAccess ? [{path: '/directory', label: t('nav_directory'), icon: UserSearch}] : []),
    ];

    const navigation = (onNavigate?: () => void) => (
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
                const Icon = item.icon;
                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onNavigate}
                        className={({isActive}) =>
                            `w-full flex items-center gap-3 px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                                isActive
                                    ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent'
                                    : 'text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text'
                            }`
                        }
                    >
                        <Icon size={16}/>
                        {item.label}
                    </NavLink>
                );
            })}
        </nav>
    );

    const logoutButton = (onAction?: () => void) => (
        <div className="p-4 border-t border-brand-border">
            <button
                onClick={() => {
                    onAction?.();
                    onLogout();
                }}
                className="w-full border border-brand-border hover:bg-red-500/10 hover:border-red-500/40 text-brand-text-muted hover:text-red-400 font-bold text-xs uppercase tracking-wider py-2.5 rounded flex items-center justify-center gap-2 transition-all"
            >
                <LogOut size={16}/>
                {t('logout_button')}
            </button>
        </div>
    );

    return <>
        <aside className="hidden md:flex flex-col w-64 bg-brand-surface border-r border-brand-border h-screen sticky top-0 shrink-0">
            <div className="p-6 border-b border-brand-border">
                <span className="text-lg font-black tracking-wider text-brand-accent">{t('app_name')}</span>
            </div>
            {navigation()}
            {logoutButton()}
        </aside>

        {mobileOpen && (
            <div className="md:hidden">
                <button
                    type="button"
                    className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
                    onClick={onMobileClose}
                    aria-label={t('nav_close')}
                />
                <aside
                    id="mobile-navigation"
                    className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col border-r border-brand-border bg-brand-surface shadow-2xl animate-in slide-in-from-left duration-200"
                    aria-label={t('nav_open')}
                >
                    <div className="flex items-center justify-between border-b border-brand-border p-5">
                        <span className="text-lg font-black tracking-wider text-brand-accent">{t('app_name')}</span>
                        <button
                            type="button"
                            onClick={onMobileClose}
                            className="flex size-10 items-center justify-center rounded-lg border border-brand-border text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text"
                            aria-label={t('nav_close')}
                        >
                            <X size={20}/>
                        </button>
                    </div>
                    {navigation(onMobileClose)}
                    {logoutButton(onMobileClose)}
                </aside>
            </div>
        )}
    </>;
};
