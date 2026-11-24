import React, {useLayoutEffect, useRef} from 'react';
import {NavLink} from 'react-router';
import {BookOpen, FlaskConical, FolderTree, BarChart3, LayoutDashboard, LucideIcon, Scan, Tv, Wrench, X, Code2} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';

interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
}

interface SidebarProps {
    canManagePallets: boolean;
    isMaintenanceOnly: boolean;
    canAccessMaintenance: boolean;
    canAccessLab: boolean;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    canManagePallets,
    isMaintenanceOnly,
    canAccessMaintenance,
    canAccessLab,
    mobileOpen = false,
    onMobileClose = () => undefined,
}) => {
    const {t} = useTranslation();
    const mobileDialog = useRef<HTMLDialogElement>(null);
    const closeMobileDialog = () => {
        mobileDialog.current?.close();
        onMobileClose();
    };
    useLayoutEffect(() => {
        const dialog = mobileDialog.current;
        if (!mobileOpen || !dialog) return;
        const desktop = window.matchMedia('(min-width: 64rem)');
        const closeOnDesktop = () => {
            if (!desktop.matches) return;
            dialog.close();
            onMobileClose();
        };
        if (desktop.matches) {
            onMobileClose();
            return;
        }
        dialog.showModal();
        desktop.addEventListener('change', closeOnDesktop);
        return () => {
            desktop.removeEventListener('change', closeOnDesktop);
            dialog.close();
        };
    }, [mobileOpen, onMobileClose]);

    const navItems: NavItem[] = [
        ...(canManagePallets ? [{path: '/catalog', label: t('nav_catalog'), icon: FolderTree}] : []),
        ...(canManagePallets ? [{path: '/admin', label: t('nav_admin'), icon: LayoutDashboard}] : []),
        ...(!isMaintenanceOnly ? [{path: '/operator', label: t('nav_operator'), icon: Scan}] : []),
        ...(canAccessMaintenance ? [{path: '/maintenance', label: t('nav_maintenance'), icon: Wrench}] : []),
        ...(canAccessLab ? [{path: '/lab', label: 'LAB', icon: FlaskConical}] : []),
        ...(canAccessMaintenance ? [{path: '/reports', label: t('nav_reports'), icon: BarChart3}] : []),
        {path: '/dashboards', label: t('nav_dashboards'), icon: Tv},
        {path: '/documentation', label: t('nav_documentation'), icon: BookOpen},
    ];

    const navigation = (onNavigate?: () => void) => (
        <nav className="flex-1 overflow-y-auto p-3 xl:p-4 space-y-1">
            {navItems.map((item) => {
                const Icon = item.icon;
                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onNavigate}
                        className={({isActive}) =>
                            `app-nav-link w-full flex items-center gap-2.5 xl:gap-3 px-3 xl:px-4 py-2.5 xl:py-3 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                                isActive
                                    ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent'
                                    : 'text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text'
                            }`
                        }
                    >
                        <Icon size={16} className="shrink-0"/>
                        {item.label}
                    </NavLink>
                );
            })}
        </nav>
    );

    const authorFooter = (
        <div className="border-t border-brand-border/60 p-3.5 bg-brand-surface/40">
            <div className="flex items-center gap-3 rounded-lg border border-brand-border/50 bg-brand-surface-high/30 p-2.5 transition-colors hover:border-brand-accent/40">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-brand-accent/30 bg-brand-accent/15 text-brand-accent">
                    <Code2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-muted">
                        {t('sidebar_author_role')}
                    </p>
                    <p className="truncate text-xs font-bold text-brand-text">
                        Mateusz Zieliński
                    </p>
                </div>
            </div>
        </div>
    );

    return <>
        <aside className="hidden lg:flex flex-col w-52 xl:w-64 bg-brand-surface border-r border-brand-border h-dvh sticky top-0 shrink-0">
            <div className="p-4 xl:p-6 border-b border-brand-border">
                <span className="text-lg font-black tracking-wider text-brand-accent">{t('app_name')}</span>
            </div>
            {navigation()}
            {authorFooter}
        </aside>

        {mobileOpen && (
            <dialog
                ref={mobileDialog}
                id="mobile-navigation"
                aria-label={t('nav_open')}
                className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent backdrop:bg-black/65 backdrop:backdrop-blur-sm"
                onCancel={event => { event.preventDefault(); closeMobileDialog(); }}
                onClick={event => { if (event.target === event.currentTarget) closeMobileDialog(); }}
            >
                <div className="flex h-full w-[min(20rem,88vw)] flex-col border-r border-brand-border bg-brand-surface shadow-2xl animate-in slide-in-from-left duration-200">
                    <div className="flex items-center justify-between border-b border-brand-border p-5">
                        <span className="text-lg font-black tracking-wider text-brand-accent">{t('app_name')}</span>
                        <button
                            type="button"
                            onClick={closeMobileDialog}
                            className="flex size-10 items-center justify-center rounded-lg border border-brand-border text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text"
                            aria-label={t('nav_close')}
                        >
                            <X size={20}/>
                        </button>
                    </div>
                    {navigation(closeMobileDialog)}
                    {authorFooter}
                </div>
            </dialog>
        )}
    </>;
};
