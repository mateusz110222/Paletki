import React, {type ReactNode} from 'react';
import {Loader2} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext.tsx';

interface ModalFormActionsProps {
    onCancel: () => void;
    submitLabel: string;
    submittingLabel?: string;
    isSubmitting?: boolean;
    submitDisabled?: boolean;
    variant?: 'primary' | 'danger';
    submitType?: 'submit' | 'button';
    onSubmit?: () => void;
    submitIcon?: ReactNode;
    additionalActionLabel?: string;
    onAdditionalAction?: () => void;
    additionalActionIcon?: ReactNode;
}

export function ModalFormActions({
    onCancel,
    submitLabel,
    submittingLabel,
    isSubmitting = false,
    submitDisabled = false,
    variant = 'primary',
    submitType = 'submit',
    onSubmit,
    submitIcon,
    additionalActionLabel,
    onAdditionalAction,
    additionalActionIcon,
}: ModalFormActionsProps) {
    const {t} = useTranslation();
    const hasAdditionalAction = Boolean(additionalActionLabel && onAdditionalAction);
    const submitColors = variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_12px_28px_rgba(220,38,38,0.35)]'
        : 'bg-brand-accent text-brand-bg hover:brightness-110 hover:shadow-[0_12px_28px_rgba(59,130,246,0.35)]';

    return (
        <div className={`${hasAdditionalAction
            ? 'grid grid-cols-1 sm:grid-cols-[0.72fr_1fr_1.35fr]'
            : 'flex flex-col sm:flex-row'
        } gap-3 pt-4 border-t border-brand-border/60`}>
            <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 min-h-12 px-4 bg-brand-bg border border-brand-border text-brand-text font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-200 hover:bg-brand-surface-high hover:border-brand-accent/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none motion-reduce:transform-none motion-reduce:transition-none"
            >
                {t('btn_cancel')}
            </button>
            {additionalActionLabel && onAdditionalAction && (
                <button
                    type="button"
                    onClick={onAdditionalAction}
                    disabled={isSubmitting || submitDisabled}
                    className="flex-1 min-h-12 px-4 bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:bg-red-500 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_12px_28px_rgba(220,38,38,0.35)] active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none motion-reduce:transform-none motion-reduce:transition-none"
                >
                    {additionalActionIcon}
                    <span>{additionalActionLabel}</span>
                </button>
            )}
            <button
                type={submitType}
                onClick={onSubmit}
                disabled={isSubmitting || submitDisabled}
                className={`flex-1 min-h-12 ${hasAdditionalAction
                    ? 'px-3 text-[10px] leading-tight tracking-[0.12em]'
                    : 'px-4 text-xs tracking-widest'
                } font-black uppercase rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_8px_18px_rgba(59,130,246,0.15)] hover:-translate-y-1 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none motion-reduce:transform-none motion-reduce:transition-none ${submitColors}`}
            >
                {isSubmitting ? (
                    <>
                        <Loader2 size={17} className="animate-spin" aria-hidden="true"/>
                        <span>{submittingLabel ?? t('btn_saving')}</span>
                    </>
                ) : (
                    <>
                        {submitIcon}
                        <span>{submitLabel}</span>
                    </>
                )}
            </button>
        </div>
    );
}
