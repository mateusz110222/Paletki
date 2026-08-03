import React, { useState, useEffect } from 'react';
import { Pallet, Project, PalletStatus, AuditLog } from '@backend/shared/types';
import { AdminPanelView as AdminPanel } from './views/AdminPanelView.tsx';
import { OperatorPanelView as OperatorPanel } from './views/OperatorPanelView.tsx';
import { MaintenancePanelView as MaintenancePanel } from './views/MaintenancePanelView.tsx';
import { LiveMonitorView as LiveMonitor } from './views/LiveMonitorView.tsx';
import { LoginView } from './views/LoginView.tsx';
import { AuthProvider, useAuth } from './auth/AuthContext.tsx';
import {
  LayoutDashboard,
  Scan,
  Wrench,
  Tv,
  AlertOctagon,
  Settings,
  Menu,
  X,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { LanguageProvider, LanguageSwitcher, useTranslation } from './i18n/LanguageContext.tsx';
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </LanguageProvider>
  );
}

function AppRoot() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <MainAppContent />;
}

function MainAppContent() {
  const { t } = useTranslation();
  const { user, isGuest, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'ADMIN' | 'OPERATOR' | 'MAINTENANCE' | 'LIVE'>(
    isGuest ? 'OPERATOR' : 'ADMIN'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [pallets, setPallets] = useState<Pallet[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchPallets = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/pallets`);

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();

        if (isMounted) {
          setPallets(data.pallets || []);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to fetch pallets:', error);
          setPallets([]);
        }
      }
    };

    fetchPallets();
    const interval = setInterval(fetchPallets, 100000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchProjects = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/projects`);

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();

        if (isMounted) {
          setProjects(data.projects || []);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to fetch projects:', error);
          setProjects([]);
        }
      }
    };

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-brand-bg text-brand-text font-sans selection:bg-brand-accent selection:text-brand-bg">

      {/* SideNavBar (Desktop View) */}
      <aside className="hidden md:flex flex-col w-64 bg-brand-surface border-r border-brand-border h-screen sticky top-0 shrink-0">
        <div className="p-6 border-b border-brand-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-black tracking-wider text-brand-accent font-sans">DASH SOLDER</span>
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-brand-text-muted/60">Facility Management v4.2</p>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-4 space-y-1">
          {!isGuest && (
            <button
              onClick={() => setActiveTab('ADMIN')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'ADMIN'
                ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent'
                : 'text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text'
                }`}
            >
              <LayoutDashboard size={16} />
              {t('nav_admin')}
            </button>
          )}

          <button
            onClick={() => setActiveTab('OPERATOR')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'OPERATOR'
              ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent'
              : 'text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text'
              }`}
          >
            <Scan size={16} />
            {t('nav_operator')}
          </button>

          {!isGuest && (
            <button
              onClick={() => setActiveTab('MAINTENANCE')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'MAINTENANCE'
                ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent'
                : 'text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text'
                }`}
            >
              <Wrench size={16} />
              {t('nav_maintenance')}
            </button>
          )}

          <button
            onClick={() => setActiveTab('LIVE')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'LIVE'
              ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent'
              : 'text-brand-text-muted hover:bg-brand-surface-high hover:text-brand-text'
              }`}
          >
            <Tv size={16} />
            {t('nav_live')}
          </button>
        </nav>

        {/* Bottom utility / E-STOP Actions & Logout */}
        <div className="p-4 border-t border-brand-border space-y-3">
          <button
            onClick={logout}
            className="w-full border border-brand-border hover:bg-red-500/10 hover:border-red-500/40 text-brand-text-muted hover:text-red-400 font-bold text-xs uppercase tracking-wider py-2.5 rounded flex items-center justify-center gap-2 transition-all"
          >
            <LogOut size={16} />
            {t('logout_button')}
          </button>
        </div>
      </aside>

      {/* Mobile Header Menu */}
      <header className="md:hidden bg-brand-surface border-b border-brand-border h-16 flex items-center justify-between px-6 z-40 sticky top-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-sm tracking-widest text-brand-accent font-sans">DASH SOLDER</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={logout}
            className="text-brand-text-muted hover:text-red-400 p-2 rounded"
            title={t('logout_button')}
          >
            <LogOut size={18} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-brand-text p-2 hover:bg-brand-surface-high rounded"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 top-16 bg-brand-bg flex flex-col justify-between">
          <nav className="p-6 space-y-3">
            {[
              ...(!isGuest ? [{ id: 'ADMIN', label: t('nav_admin'), icon: LayoutDashboard }] : []),
              { id: 'OPERATOR', label: t('nav_operator'), icon: Scan },
              ...(!isGuest ? [{ id: 'MAINTENANCE', label: t('nav_maintenance'), icon: Wrench }] : []),
              { id: 'LIVE', label: t('nav_live'), icon: Tv },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${activeTab === item.id
                    ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent'
                    : 'text-brand-text-muted bg-brand-surface border border-brand-border/40'
                    }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>

        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-w-[1600px] mx-auto w-full">
        {/* Top bar */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-brand-border/50">
          <div>
            <h2 className="text-2xl font-extrabold text-brand-text">
              {activeTab === 'ADMIN' && t('panel_admin_title')}
              {activeTab === 'OPERATOR' && t('panel_operator_title')}
              {activeTab === 'MAINTENANCE' && t('panel_maint_title')}
              {activeTab === 'LIVE' && t('panel_live_title')}
            </h2>
            <p className="text-xs text-brand-text-muted mt-1 font-medium">
              {activeTab === 'ADMIN' && t('panel_admin_subtitle')}
              {activeTab === 'OPERATOR' && t('panel_operator_subtitle')}
              {activeTab === 'MAINTENANCE' && t('panel_maint_subtitle')}
              {activeTab === 'LIVE' && t('panel_live_subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <LanguageSwitcher />
            {/* User Info Tag */}
            {user && (
              <div className="flex items-center gap-3 bg-brand-surface border border-brand-border px-4 py-2 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-brand-accent font-bold text-xs">
                  <UserCheck size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-brand-text leading-tight">{isGuest ? t('guest_name') : user.FullName}</p>
                  <p className="text-[10px] text-brand-text-muted font-mono leading-tight">
                    {isGuest ? t('guest_department') : (user.department ? `${user.department}` : '')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Panels */}
        {!isGuest && activeTab === 'ADMIN' && (
          <AdminPanel
            pallets={pallets}
            projects={projects}
            setPallets={setPallets}
            setProjects={setProjects}
          />
        )}

        {activeTab === 'OPERATOR' && (
          <OperatorPanel
            pallets={pallets}
            setPallets={setPallets}
          />
        )}

        {!isGuest && activeTab === 'MAINTENANCE' && (
          <MaintenancePanel
            pallets={pallets}
            setPallets={setPallets}
          />
        )}

        {activeTab === 'LIVE' && (
          <LiveMonitor
            pallets={pallets}
          />
        )}
      </main>
    </div>
  );
}
