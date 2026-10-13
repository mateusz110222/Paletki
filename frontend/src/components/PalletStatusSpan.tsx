import React from "react";
import {AlertTriangle, CircleCheck, LockKeyhole, WashingMachine} from 'lucide-react';
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

const STATUS_CONFIG: Record<string, { className: string; labelKey: TranslationKey; icon?: string }> = {
    Active: {
        className: "bg-green-500/10 text-green-400 border-green-500/20",
        labelKey: "status_active",
    },
    Blocked: {
        className: "bg-red-500/10 text-red-400 border-red-500/20 cursor-help",
        labelKey: "status_blocked",
        icon: "🛈",
    },
    Washing_Required: {
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        labelKey: "status_washing_required",
    },
    Damaged: {
        className: "bg-red-500/20 text-red-500 border-red-500/40",
        labelKey: "status_damaged",
    },
};

const BASE_STYLES = "px-2 py-1 text-[10px] font-bold rounded-full border uppercase inline-block";
const FALLBACK_STYLES = "bg-brand-surface-high text-brand-text-muted border-brand-border";

export function PalletStatusSpan({ status, block_reason, emphasis = false }: PalletStatusSpanProps): React.JSX.Element {
    const { t } = useTranslation();
    const config = STATUS_CONFIG[status];
    if (emphasis && config) {
        const prominent = EMPHASIZED_STATUS[status];
        const Icon = prominent.icon;
        return <span title={status === 'Blocked' ? block_reason || '' : undefined}
            className={`inline-flex min-h-11 items-center gap-2.5 rounded-full border px-4 py-2.5 text-xs font-black uppercase tracking-wider sm:text-sm ${prominent.className}`}>
            <Icon size={20} strokeWidth={2.5} aria-hidden="true" className="shrink-0"/>
            <span>{t(config.labelKey)}</span>
        </span>;
    }

    if (!config) {
        return (
            <span className={`${BASE_STYLES} ${FALLBACK_STYLES}`}>
                {status}
            </span>
        );
    }

    return (
        <span
            title={status === 'Blocked' ? block_reason || '' : undefined}
            className={`${BASE_STYLES} ${config.className}`}
        >
            {t(config.labelKey)} {config.icon && `${config.icon}`}
        </span>
    );
}
