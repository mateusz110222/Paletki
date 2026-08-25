import React, {useState} from 'react';
import {NavLink} from 'react-router-dom';
import {LayoutDashboard, LogOut, LucideIcon, Menu, Scan, Tv, Wrench, X} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';

interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
}

interface MobileNavProps {
    hasITDepartmentAccess: boolean;
    onLogout: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({hasITDepartmentAccess, onLogout}) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const {t} = useTranslation();

    const navItems: NavItem[] = [
        ...(hasITDepartmentAccess ? [{path: '/admin', label: t('nav_admin'), icon: LayoutDashboard}] : []),
        {path: '/operator', label: t('nav_operator'), icon: Scan},
        ...(hasITDepartmentAccess ? [{path: '/maintenance', label: t('nav_maintenance'), icon: Wrench}] : []),
        {path: '/live', label: t('nav_live'), icon: Tv},
    ];

    return (
        <>
            {/* Upper Mobile Bar */}
            <header
                className="md:hidden bg-brand-surface border-b border-brand-border h-16 flex items-center justify-between px-6 z-40 sticky top-0">
                <div className="flex items-center gap-2">
          <span className="font-black text-sm tracking-widest text-brand-accent font-sans">
            {t('app_name')}
          </span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onLogout}
                        className="text-brand-text-muted hover:text-red-400 p-2 rounded transition-colors"
                        title={t('logout_button')}
                    >
                        <LogOut size={18}/>
                    </button>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        title={t(mobileMenuOpen ? 'btn_close_menu' : 'btn_open_menu')}
                        aria-label={t(mobileMenuOpen ? 'btn_close_menu' : 'btn_open_menu')}
                        className="text-brand-text p-2 hover:bg-brand-surface-high rounded transition-colors"
                    >
                        {mobileMenuOpen ? <X size={20} aria-hidden="true"/> : <Menu size={20} aria-hidden="true"/>}
                    </button>
                </div>
            </header>

            {/* Mobile Menu Drawer */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 top-16 bg-brand-bg flex flex-col justify-between">
                    <nav className="p-6 space-y-3">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={({isActive}) =>
                                        `w-full flex items-center gap-4 p-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${
                                            isActive
                                                ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent'
                                                : 'text-brand-text-muted bg-brand-surface border border-brand-border/40'
                                        }`
                                    }
                                >
                                    <Icon size={18}/>
                                    {item.label}
                                </NavLink>
                            );
                        })}
                    </nav>
                </div>
            )}
        </>
    );
};
