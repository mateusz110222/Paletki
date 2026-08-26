import React, {createContext, use, useCallback, useEffect, useState, type ReactElement, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

const ModalPresenceContext = createContext({isExiting: false, onExitComplete: () => {}});

/** Keep the last modal content mounted until its CSS exit animation finishes. */
export function ModalPresence({children}: {children: ReactElement | null | false}) {
    const child = children || null;
    const [snapshot, setSnapshot] = useState({input: child, retained: child});
    const isPresent = child !== null;

    // Capture the element before the parent clears its selected pallet/form data.
    // Reconcile during render so closing never paints an empty modal first.
    if (snapshot.input !== child) {
        setSnapshot({input: child, retained: child ?? snapshot.retained});
    }

    const onExitComplete = useCallback(() => {
        setSnapshot((current) => current.input === null && current.retained !== null
            ? {input: null, retained: null}
            : current);
    }, []);

    useEffect(() => {
        if (isPresent) return;
        // Fallback if the browser does not dispatch animationend (e.g. a hidden tab).
        const timer = window.setTimeout(onExitComplete, 250);
        return () => window.clearTimeout(timer);
    }, [isPresent, onExitComplete]);

    return (
        <ModalPresenceContext value={{isExiting: !isPresent, onExitComplete}}>
            {child ?? snapshot.retained}
        </ModalPresenceContext>
    );
}

interface ModalTransitionProps {
    children: ReactNode;
    onBackdropClick: () => void;
    className?: string;
    backdropClassName?: string;
}

export function ModalTransition({
    children,
    onBackdropClick,
    className = '',
    backdropClassName = 'bg-brand-bg/80 backdrop-blur-sm',
}: ModalTransitionProps) {
    const {isExiting, onExitComplete} = use(ModalPresenceContext);

    return createPortal(
        <div
            className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}
            data-state={isExiting ? 'closing' : 'open'}
            inert={isExiting}
            onAnimationEnd={(event) => {
                if (isExiting && event.target === event.currentTarget) onExitComplete();
            }}
        >
            <div
                className={`fixed inset-0 ${backdropClassName}`}
                onClick={onBackdropClick}
                aria-hidden="true"
            />
            <div
                className="modal-panel relative z-10 flex w-full justify-center"
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
