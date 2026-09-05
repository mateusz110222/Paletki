import {useCallback, useEffect, useRef} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Maximize, Minimize} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';
import {useToast} from './ToastProvider';

export function DisplayModeControl() {
    const {language} = useTranslation();
    const notify = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const enabled = ['1', 'true'].includes(searchParams.get('tv') ?? '');
    const ownsFullscreenRef = useRef(false);
    const setEnabled = useCallback((value: boolean) => {
        setSearchParams(current => {
            const next = new URLSearchParams(current);
            if (value) next.set('tv', '1'); else next.delete('tv');
            return next;
        }, {replace: true});
    }, [setSearchParams]);
    useEffect(() => {
        const sync = () => {
            if (!document.fullscreenElement && ownsFullscreenRef.current) {
                ownsFullscreenRef.current = false;
                setEnabled(false);
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setEnabled(false);
                if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
            }
        };
        document.addEventListener('fullscreenchange', sync);
        window.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('fullscreenchange', sync);
            window.removeEventListener('keydown', escape);
        };
    }, [setEnabled]);
    useEffect(() => () => {
        if (ownsFullscreenRef.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }, []);
    useEffect(() => {
        document.documentElement.classList.toggle('tv-mode', enabled);
        if (!enabled && ownsFullscreenRef.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        return () => document.documentElement.classList.remove('tv-mode');
    }, [enabled]);
    const toggle = async () => {
        if (enabled) {
            setEnabled(false);
        } else {
            setEnabled(true);
            try { await document.documentElement.requestFullscreen(); ownsFullscreenRef.current = true; }
            catch { notify(language === 'pl' ? 'Tryb TV włączony. Pełny ekran jest niedostępny — możesz użyć F11.' : 'TV mode enabled. Fullscreen is unavailable — you can use F11.', 'info'); }
        }
    };
    return <button type="button" aria-pressed={enabled} onClick={() => void toggle()}
        className="tv-toggle fixed bottom-5 left-5 z-50 inline-flex items-center gap-2 rounded-xl border border-indigo-300/30 bg-brand-surface px-4 py-3 text-xs font-bold text-indigo-200 shadow-xl">
        {enabled ? <Minimize size={18}/> : <Maximize size={18}/>}
        {enabled ? (language === 'pl' ? 'Wyjdź z TV · Esc' : 'Exit TV · Esc') : (language === 'pl' ? 'Tryb TV' : 'TV mode')}
    </button>;
}
