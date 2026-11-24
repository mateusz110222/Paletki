import React, {useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent} from "react";
import {AlertTriangle, CircleCheck, Info, LockKeyhole, WashingMachine} from 'lucide-react';
import { PalletStatus } from "@backend/shared/types.ts";
import { useTranslation, TranslationKey } from "../i18n/LanguageContext.tsx";

interface PalletStatusSpanProps {
    status: PalletStatus;
    block_reason?: string | null;
    emphasis?: boolean;
}

const EMPHASIZED_STATUS = {
    Active: {icon: CircleCheck, className: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/60 shadow-[0_0_20px_rgba(52,211,153,0.10)]'},
    Washing_Required: {icon: WashingMachine, className: 'bg-amber-400/20 text-amber-200 border-amber-400/70 shadow-[0_0_20px_rgba(251,191,36,0.12)]'},
    Damaged: {icon: AlertTriangle, className: 'bg-red-500/20 text-red-200 border-red-400/70 shadow-[0_0_20px_rgba(248,113,113,0.12)]'},
    Blocked: {icon: LockKeyhole, className: 'bg-red-500/20 text-red-200 border-red-400/70 shadow-[0_0_20px_rgba(248,113,113,0.12)]'},
};

const STATUS_CONFIG: Record<string, { className: string; labelKey: TranslationKey }> = {
    Active: {
        className: "bg-green-500/10 text-green-400 border-green-500/20",
        labelKey: "status_active",
    },
    Blocked: {
        className: "bg-red-500/10 text-red-400 border-red-500/20",
        labelKey: "status_blocked",
    },
    Washing_Required: {
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        labelKey: "status_washing_required",
    },
    Damaged: {
        className: "bg-red-500/20 text-red-300 border-red-500/40",
        labelKey: "status_damaged",
    },
};

const BASE_STYLES = "px-2 py-1 text-xs font-bold rounded-full border uppercase inline-flex items-center gap-1 text-center align-middle";
const FALLBACK_STYLES = "bg-brand-surface-high text-brand-text-muted border-brand-border";

function StatusWithReason({className, label, heading, reason, children}: {
    className: string; label: string; heading: string; reason: string; children: ReactNode;
}) {
    const tooltip = useRef<HTMLSpanElement>(null);
    const id = useId();
    const [open, setOpen] = useState(false);

    function show(event: SyntheticEvent<HTMLButtonElement>) {
        const panel = tooltip.current;
        if (!panel || panel.matches(':popover-open')) return;
        const anchor = event.currentTarget.getBoundingClientRect();
        panel.showPopover();
        const {width, height} = panel.getBoundingClientRect();
        const {clientWidth, clientHeight} = document.documentElement;
        const padding = 8;
        const left = anchor.left + (anchor.width - width) / 2;
        const above = anchor.top - height;
        const top = above >= padding || clientHeight - anchor.bottom < anchor.top ? above : anchor.bottom;
        panel.style.left = `${Math.max(padding, Math.min(left, clientWidth - width - padding))}px`;
        panel.style.top = `${Math.max(padding, Math.min(top, clientHeight - height - padding))}px`;
    }

    function hide() {
        if (tooltip.current?.matches(':popover-open')) tooltip.current.hidePopover();
    }

    useEffect(() => {
        if (!open) return;
        function onScroll(event: Event) {
            if (event.target !== tooltip.current) hide();
        }
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', hide);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', hide);
        };
    }, [open]);

    return <button type="button" aria-label={label} aria-describedby={id} className={className}
        onMouseEnter={show} onFocus={show} onClick={show} onBlur={hide}
        onMouseLeave={event => {if (!event.currentTarget.matches(':focus-visible')) hide();}}>
        {children}
        <span id={id} ref={tooltip} role="tooltip" popover="auto"
            onToggle={event => setOpen(event.newState === 'open')}
            className="fixed inset-auto top-0 left-0 m-0 max-h-[min(18rem,calc(100dvh-1rem))] w-max max-w-[min(22rem,calc(100vw-1rem))] overflow-auto rounded-xl border border-brand-border border-s-3 border-s-red-400 bg-brand-surface px-4 py-3 text-left text-sm font-normal normal-case tracking-normal text-brand-text shadow-xl">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-red-300">
                <Info size={14} aria-hidden="true"/>{heading}
            </span>
            <span className="block wrap-anywhere whitespace-pre-wrap leading-relaxed">{reason}</span>
        </span>
    </button>;
}

export function PalletStatusSpan({ status, block_reason, emphasis = false }: PalletStatusSpanProps): React.JSX.Element {
    const { t } = useTranslation();
    const config = STATUS_CONFIG[status];
    let className = `${BASE_STYLES} ${config?.className ?? FALLBACK_STYLES}`;
    let content: ReactNode = config ? t(config.labelKey) : status;
    if (emphasis && config) {
        const prominent = EMPHASIZED_STATUS[status];
        const Icon = prominent.icon;
        className = `inline-flex min-h-11 items-center gap-2.5 rounded-full border px-4 py-2.5 text-xs font-black uppercase tracking-wider sm:text-sm ${prominent.className}`;
        content = <>
            <Icon size={20} strokeWidth={2.5} aria-hidden="true" className="shrink-0"/>
            <span>{content}</span>
        </>;
    }
    if (status === 'Blocked' || status === 'Damaged') {
        const blocked = status === 'Blocked';
        return <StatusWithReason className={className} label={t(blocked ? 'status_blocked' : 'status_damaged')}
            heading={t(blocked ? 'block_reason' : 'damage_reason')}
            reason={block_reason?.trim() || t(blocked ? 'block_reason_missing' : 'op_damage_reason_missing')}>
            {content}
            {!emphasis && <Info size={13} aria-hidden="true" className="shrink-0"/>}
        </StatusWithReason>;
    }
    return <span className={className}>{content}</span>;
}
