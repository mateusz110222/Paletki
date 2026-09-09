import React, {useId, useRef, type ComponentProps, type ReactNode} from 'react';
import {ChevronUp, ChevronDown} from 'lucide-react';

interface FieldProps {
    label: ReactNode;
    fieldClassName?: string;
    labelClassName?: string;
}

const controlClassName = 'w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs text-brand-text focus:ring-2 focus:ring-brand-accent/30 outline-none';

function Field({label, fieldClassName = 'flex flex-col gap-1.5',
    labelClassName = 'text-[11px] font-bold text-brand-text-muted uppercase tracking-wider',
    id, children}: FieldProps & {id: string; children: ReactNode}) {
    return (
        <div className={fieldClassName}>
            <label htmlFor={id} className={labelClassName}>{label}</label>
            {children}
        </div>
    );
}

export function InputField({label, fieldClassName, labelClassName, id, className, type,
    ...props}: FieldProps & ComponentProps<'input'>) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const inputRef = useRef<HTMLInputElement>(null);

    const changeValue = (delta: number) => {
        const input = inputRef.current;
        if (!input || input.disabled || input.readOnly) return;
        const currentVal = input.value === '' ? 0 : Number(input.value);
        const step = Number(input.step) || 1;
        const min = input.min !== '' ? Number(input.min) : -Infinity;
        const max = input.max !== '' ? Number(input.max) : Infinity;
        let nextVal = Number.isNaN(currentVal) ? (min !== -Infinity ? min : 0) : currentVal + delta * step;
        if (nextVal < min) nextVal = min;
        if (nextVal > max) nextVal = max;

        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(input, String(nextVal));
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
    };

    if (type === 'number') {
        return (
            <Field label={label} fieldClassName={fieldClassName} labelClassName={labelClassName} id={inputId}>
                <div className="relative w-full">
                    <input
                        {...props}
                        ref={inputRef}
                        type="number"
                        id={inputId}
                        className={className ?? `${controlClassName} font-mono transition-all pr-8`}
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-0.5 rounded-lg border border-brand-border/60 bg-brand-surface-high/70 p-0.5 shadow-sm select-none pointer-events-auto">
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-label="Zwiększ"
                            disabled={Boolean(props.disabled || props.readOnly)}
                            onClick={() => changeValue(1)}
                            className="flex h-3.5 w-5 items-center justify-center rounded text-brand-text-muted hover:bg-brand-accent/20 hover:text-indigo-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                            <ChevronUp size={11} strokeWidth={2.5} />
                        </button>
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-label="Zmniejsz"
                            disabled={Boolean(props.disabled || props.readOnly)}
                            onClick={() => changeValue(-1)}
                            className="flex h-3.5 w-5 items-center justify-center rounded text-brand-text-muted hover:bg-brand-accent/20 hover:text-indigo-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                            <ChevronDown size={11} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </Field>
        );
    }

    return (
        <Field label={label} fieldClassName={fieldClassName} labelClassName={labelClassName} id={inputId}>
            <input {...props} type={type} id={inputId} className={className ?? `${controlClassName} font-mono transition-all`}/>
        </Field>
    );
}

export const NumberField = (props: FieldProps & ComponentProps<'input'>) => <InputField {...props} type="number"/>;

export function SelectField({label, fieldClassName, labelClassName, id, className, monospace = false,
    ...props}: FieldProps & ComponentProps<'select'> & {monospace?: boolean}) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
        <Field label={label} fieldClassName={fieldClassName} labelClassName={labelClassName} id={inputId}>
            <select {...props} id={inputId} className={className ?? `${controlClassName}${monospace ? ' font-mono' : ''} transition-all cursor-pointer`}/>
        </Field>
    );
}

export function TextareaField({label, fieldClassName, labelClassName, id, className,
    ...props}: FieldProps & ComponentProps<'textarea'>) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
        <Field label={label} fieldClassName={fieldClassName} labelClassName={labelClassName} id={inputId}>
            <textarea {...props} id={inputId} className={className ?? `${controlClassName} transition-all`}/>
        </Field>
    );
}
