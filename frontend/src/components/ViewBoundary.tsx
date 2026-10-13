import {Component, Suspense, type ReactNode} from 'react';
import {useLocation} from 'react-router';
import {AlertTriangle, Loader2, RefreshCw} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';

export function ViewLoading() {
    const {t} = useTranslation();
    return <div role="status" className="flex min-h-48 items-center justify-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-6 text-sm text-brand-text-muted">
        <Loader2 size={20} className="animate-spin text-brand-accent" aria-hidden="true"/>{t('view_loading')}
    </div>;
}

export function ViewLoadError() {
    const {t} = useTranslation();
    return <div role="alert" className="rounded-xl border border-red-400/30 bg-brand-surface p-6 text-brand-text">
        <h3 className="flex items-center gap-2 font-bold"><AlertTriangle size={20} className="text-red-400" aria-hidden="true"/>{t('view_load_error')}</h3>
        <p className="mt-3 text-sm leading-relaxed text-brand-text-muted">{t('view_load_error_hint')}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-border px-4 text-sm font-bold hover:border-brand-accent"><RefreshCw size={16} aria-hidden="true"/>{t('view_reload')}</button>
    </div>;
}

class RouteErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
    state = {failed: false};
    static getDerivedStateFromError() {return {failed: true};}
    render() {return this.state.failed ? <ViewLoadError/> : this.props.children;}
}

export function ViewBoundary({children}: {children: ReactNode}) {
    const {pathname} = useLocation();
    return <RouteErrorBoundary key={pathname}><Suspense fallback={<ViewLoading/>}>{children}</Suspense></RouteErrorBoundary>;
}
