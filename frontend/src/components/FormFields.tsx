import React, {useId, type ComponentProps, type ReactNode} from 'react';

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

export function InputField({label, fieldClassName, labelClassName, id, className,
    ...props}: FieldProps & ComponentProps<'input'>) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
        <Field label={label} fieldClassName={fieldClassName} labelClassName={labelClassName} id={inputId}>
            <input {...props} id={inputId} className={className ?? `${controlClassName} font-mono transition-all`}/>
        </Field>
    );
}

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
