import React from "react";
import { PalletStatus } from "@backend/shared/types.ts";
import { useTranslation } from "../i18n/LanguageContext.tsx";

interface PalletStatusSpanProps {
    status: PalletStatus;
    block_reason?: string;
}

const STATUS_CONFIG: Record<string, { className: string; labelKey: string; icon?: string }> = {
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
        labelKey: "status_Washing_Required",
    },
    Damaged: {
        className: "bg-red-500/20 text-red-500 border-red-500/40",
        labelKey: "status_damaged",
    },
};

const BASE_STYLES = "px-2 py-1 text-[10px] font-bold rounded-full border uppercase inline-block";
const FALLBACK_STYLES = "bg-brand-surface-high text-brand-text-muted border-brand-border";

export function PalletStatusSpan({ status, block_reason }: PalletStatusSpanProps): React.JSX.Element {
    const { t } = useTranslation();
    const config = STATUS_CONFIG[status];

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