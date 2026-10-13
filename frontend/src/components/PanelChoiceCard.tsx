import {Link} from 'react-router';
import {ArrowUpRight, type LucideIcon} from 'lucide-react';

export function PanelChoiceCard({to, title, description, eyebrow, icon: Icon, tone = 'accent'}: {
    to: string; title: string; description: string; eyebrow: string; icon: LucideIcon; tone?: 'accent' | 'teal';
}) {
    return <Link to={to} className="group relative flex min-h-64 flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:border-brand-accent/50 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:p-8">
        <div className={`absolute inset-x-0 top-0 h-1 ${tone === 'teal' ? 'bg-emerald-400/60' : 'bg-brand-accent/70'}`}/>
        <div className="flex items-start justify-between gap-4">
            <span className={`flex size-14 items-center justify-center rounded-xl border ${tone === 'teal' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-brand-accent/20 bg-brand-accent/10 text-brand-accent'}`}><Icon size={26}/></span>
            <ArrowUpRight size={22} className="text-brand-text-muted transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand-text"/>
        </div>
        <p className="mt-7 text-[10px] font-black uppercase tracking-[0.18em] text-brand-text-muted">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-brand-text">{title}</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-brand-text-muted">{description}</p>
    </Link>;
}
