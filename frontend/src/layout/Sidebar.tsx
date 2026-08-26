import React from 'react';
import {NavLink} from 'react-router-dom';
import {LayoutDashboard, LogOut, LucideIcon, Scan, Tv, Wrench, UserSearch} from 'lucide-react';
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
}

export const Sidebar: React.FC<SidebarProps> = ({hasITDepartmentAccess, canManagePallets, isMaintenanceOnly, canAccessMaintenance, onLogout}) => {
    const {t} = useTranslation();

    const navItems: NavItem[] = [
        ...(canManagePallets ? [{path: '/admin', label: t('nav_admin'), icon: LayoutDashboard}] : []),
        ...(!isMaintenanceOnly ? [{path: '/operator', label: t('nav_operator'), icon: Scan}] : []),
        ...(canAccessMaintenance ? [{path: '/maintenance', label: t('nav_maintenance'), icon: Wrench}] : []),
        ...(!isMaintenanceOnly ? [{path: '/live', label: t('nav_live'), icon: Tv}] : []),
        ...(hasITDepartmentAccess ? [{path: '/directory', label: t('nav_directory'), icon: UserSearch}] : []),
    ];

    return (
        <aside
            className="hidden md:flex flex-col w-64 bg-brand-surface border-r border-brand-border h-screen sticky top-0 shrink-0">
            <div className="p-6 border-b border-brand-border">
                <span className="text-lg font-black tracking-wider text-brand-accent">{t('app_name')}</span>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
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

            <div className="p-4 border-t border-brand-border">
                <button
                    onClick={onLogout}
                    className="w-full border border-brand-border hover:bg-red-500/10 hover:border-red-500/40 text-brand-text-muted hover:text-red-400 font-bold text-xs uppercase tracking-wider py-2.5 rounded flex items-center justify-center gap-2 transition-all"
                >
                    <LogOut size={16}/>
                    {t('logout_button')}
                </button>
            </div>
        </aside>
    );
};
