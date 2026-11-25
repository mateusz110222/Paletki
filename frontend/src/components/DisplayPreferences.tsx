import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';
import {BookOpen, ChevronDown, LogOut, Monitor, Moon, Settings2, Sun} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';

const themes = [
    {value: 'light', icon: Sun, label: 'theme_light'},
    {value: 'dark', icon: Moon, label: 'theme_dark'},
    {value: 'system', icon: Monitor, label: 'theme_system'},
] as const;

type Theme = typeof themes[number]['value'];
type Account = {name: string; subtitle: string; logout: () => Promise<void>};

const optionClass = 'flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 text-sm font-semibold text-brand-text-muted hover:text-brand-text aria-pressed:border-brand-accent/40 aria-pressed:bg-brand-surface aria-pressed:text-indigo-200';

export function DisplayPreferences({account}: {account?: Account}) {
    const {language, setLanguage, t} = useTranslation();
    const details = useRef<HTMLDetailsElement>(null);
    const trigger = useRef<HTMLElement>(null);
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = typeof document === 'undefined' ? undefined : document.documentElement.dataset.themePreference;
        return saved === 'light' || saved === 'system' ? saved : 'dark';
    });

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const root = document.documentElement;
        function applyTheme() {
            root.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
            document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
                ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--color-brand-bg').trim());
        }
        applyTheme();
        if (theme !== 'system') return;
        media.addEventListener('change', applyTheme);
        return () => media.removeEventListener('change', applyTheme);
    }, [theme]);

    useEffect(() => {
        function dismissOutside(event: PointerEvent) {
            const menu = details.current;
            if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
        }
        function dismissOnEscape(event: KeyboardEvent) {
            if (event.key !== 'Escape' || !details.current?.open) return;
            event.preventDefault();
            event.stopPropagation();
            details.current.open = false;
            trigger.current?.focus();
        }
        document.addEventListener('pointerdown', dismissOutside);
        document.addEventListener('keydown', dismissOnEscape, true);
        return () => {
            document.removeEventListener('pointerdown', dismissOutside);
            document.removeEventListener('keydown', dismissOnEscape, true);
        };
    }, []);

    function chooseTheme(value: Theme) {
        document.documentElement.dataset.themePreference = value;
        setTheme(value);
        try {
            localStorage.setItem('palletx-theme', value);
        } catch {
            // The choice still applies to the current page.
        }
    }

    function close() {
        if (details.current) details.current.open = false;
    }

    const initials = account?.name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase(language);
    return (
        <details ref={details} className="group relative min-w-0 max-w-full open:z-40">
            <summary ref={trigger} className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-2.5 py-1.5 text-sm font-semibold text-brand-text hover:bg-brand-surface-high [&::-webkit-details-marker]:hidden">
                {account ? <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-accent/15 text-xs font-bold text-indigo-200">{initials}</span>
                    : <Settings2 size={17} aria-hidden="true" className="shrink-0 text-indigo-200"/>}
                <span className="min-w-0 truncate">{account?.name || t('display_preferences')}</span>
                <ChevronDown size={15} aria-hidden="true" className="shrink-0 text-brand-text-muted transition-transform duration-200 group-open:rotate-180"/>
            </summary>
            <div className="ui-dropdown-panel fixed inset-x-3 mt-2 max-h-[min(24rem,65dvh)] space-y-3 overflow-y-auto rounded-xl border border-brand-border bg-brand-surface p-3 text-brand-text shadow-xl md:absolute md:inset-x-auto md:end-0 md:top-full md:w-80">
                {account && <div className="flex items-center gap-3 border-b border-brand-border pb-3">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-accent text-sm font-bold text-brand-on-accent">{initials}</span>
                    <div className="min-w-0 wrap-anywhere">
                        <p className="text-sm font-bold">{account.name}</p>
                        {account.subtitle && <p className="text-sm text-brand-text-muted">{account.subtitle}</p>}
                    </div>
                </div>}
                <fieldset className="min-w-0">
                    <legend className="mb-1.5 text-xs font-bold text-brand-text-muted">{t('display_language')}</legend>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-brand-bg p-1">
                        <button type="button" aria-pressed={language === 'pl'} onClick={() => setLanguage('pl')} className={optionClass}>Polski</button>
                        <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')} className={optionClass}>English</button>
                    </div>
                </fieldset>
                <fieldset className="min-w-0">
                    <legend className="mb-1.5 text-xs font-bold text-brand-text-muted">{t('display_appearance')}</legend>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-brand-bg p-1">
                        {themes.map(({value, icon: Icon, label}) => <button key={value} type="button" aria-pressed={theme === value}
                            onClick={() => chooseTheme(value)} className={optionClass}>
                            <Icon size={15} aria-hidden="true" className="shrink-0"/>{t(label)}
                        </button>)}
                    </div>
                </fieldset>
                {account && <div className="space-y-1 border-t border-brand-border pt-2">
                    <Link to="/documentation" onClick={close} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-brand-surface-high">
                        <BookOpen size={16} aria-hidden="true"/>{t('nav_documentation')}
                    </Link>
                    <button type="button" onClick={() => {close(); void account.logout();}} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm hover:bg-red-500/10 hover:text-red-400">
                        <LogOut size={16} aria-hidden="true"/>{t('logout_button')}
                    </button>
                </div>}
            </div>
        </details>
    );
}
