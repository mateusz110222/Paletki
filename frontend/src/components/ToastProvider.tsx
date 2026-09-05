import {createContext, use, useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {CheckCircle2, AlertCircle, X} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';

type Tone = 'success' | 'error' | 'info';
type Notice = {id: number; message: string; tone: Tone};
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});
export const useToast = () => use(ToastContext);

function ToastItem({notice, dismiss}: {notice: Notice; dismiss: (id: number) => void}) {
    const {language} = useTranslation();
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        if (paused || notice.tone === 'error') return;
        const timer = window.setTimeout(() => dismiss(notice.id), 5000);
        return () => window.clearTimeout(timer);
    }, [notice.id, notice.tone, dismiss, paused]);
    return <div role={notice.tone === 'error' ? 'alert' : 'status'}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
        className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-2xl animate-in fade-in bg-brand-surface ${notice.tone === 'error' ? 'border-rose-400/50 text-rose-200' : 'border-emerald-400/30 text-brand-text'}`}>
        {notice.tone === 'error' ? <AlertCircle className="shrink-0 text-rose-400" size={20}/> : <CheckCircle2 className="shrink-0 text-emerald-400" size={20}/>}
        <p className="min-w-0 flex-1 break-words text-sm font-semibold">{notice.message}</p>
        <button type="button" onClick={() => dismiss(notice.id)} className="shrink-0 rounded p-1" aria-label={language === 'pl' ? 'Zamknij powiadomienie' : 'Dismiss notification'}><X size={18}/></button>
    </div>;
}

export function ToastProvider({children}: {children: ReactNode}) {
    const [notices, setNotices] = useState<Notice[]>([]);
    const nextIdRef = useRef(0);
    const notify = useCallback((message: string, tone: Tone = 'success') => {
        const id = ++nextIdRef.current;
        setNotices(current => [...current.slice(-4), {id, message, tone}]);
    }, []);
    const dismiss = useCallback((id: number) => setNotices(current => current.filter(n => n.id !== id)), []);
    return <ToastContext value={notify}>{children}<div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex max-h-[80dvh] w-[min(26rem,calc(100vw-2rem))] flex-col gap-2 overflow-y-auto">
        {notices.map(notice => <ToastItem key={notice.id} notice={notice} dismiss={dismiss}/>)}
    </div></ToastContext>;
}
