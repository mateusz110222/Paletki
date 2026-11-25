import React, {createContext, use, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

const ModalPresenceContext = createContext({isExiting: false, onExitComplete: () => {}});
const focusable = 'button, [href], input, select, textarea, summary, [tabindex]';
const openDialogs: HTMLElement[] = [];
const dialogReturnFocus = new WeakMap<HTMLElement, Element | null>();
let rootWasInert = false;
let scrollLockCount = 0;
let savedRootPaddingRight: string | null = null;

function focusableChildren(panel: HTMLElement) {
    return [...panel.querySelectorAll<HTMLElement>(focusable)].filter(control =>
        control.tabIndex >= 0 && !control.matches(':disabled') && control.getClientRects().length > 0);
}

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
    const alignClass = /\bitems-(start|end|baseline|stretch)\b/.test(className) ? '' : 'items-center';
    const content = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const [previousFocus] = useState(() => {
        const active = document.activeElement;
        const closingOverlay = active instanceof HTMLElement
            ? active.closest<HTMLElement>('.modal-overlay[data-state="closing"]')
            : null;
        return closingOverlay && dialogReturnFocus.has(closingOverlay)
            ? dialogReturnFocus.get(closingOverlay) ?? null
            : active;
    });

    useLayoutEffect(() => {
        if (scrollLockCount === 0) {
            const html = document.documentElement;
            const root = document.getElementById('root');
            const gutter = window.innerWidth - html.clientWidth;
            savedRootPaddingRight = root?.style.paddingRight ?? '';
            html.dataset.modalOpen = '';
            if (root && gutter > 0) {
                root.style.paddingRight = `${gutter}px`;
            }
        }
        scrollLockCount++;
        return () => {
            scrollLockCount--;
            if (scrollLockCount === 0) {
                const html = document.documentElement;
                const root = document.getElementById('root');
                delete html.dataset.modalOpen;
                if (root && savedRootPaddingRight !== null) {
                    root.style.paddingRight = savedRootPaddingRight;
                }
                savedRootPaddingRight = null;
            }
        };
    }, []);

    useLayoutEffect(() => {
        const panel = content.current;
        if (!panel || isExiting) return;
        const overlay = panel.parentElement;
        if (!overlay) return;
        dialogReturnFocus.set(overlay, previousFocus);
        const root = document.getElementById('root');
        if (openDialogs.length === 0 && root) {
            rootWasInert = root.inert;
            root.inert = true;
        }
        const previousDialog = openDialogs.at(-1);
        if (previousDialog) previousDialog.inert = true;
        openDialogs.push(overlay);
        if (!panel.querySelector('[role="dialog"], [role="alertdialog"]')) {
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            const heading = panel.querySelector('h2, h3');
            if (heading) {
                heading.id ||= titleId;
                panel.setAttribute('aria-labelledby', heading.id);
            }
        }
        if (!panel.contains(document.activeElement)) (focusableChildren(panel)[0] ?? panel).focus();
        return () => {
            const wasTop = openDialogs.at(-1) === overlay;
            openDialogs.splice(openDialogs.indexOf(overlay), 1);
            const top = openDialogs.at(-1);
            if (wasTop && top) top.inert = false;
            if (!top && root) root.inert = rootWasInert;
            queueMicrotask(() => {
                const topDialog = openDialogs.at(-1);
                if ((!overlay.isConnected || overlay.dataset.state === 'closing') &&
                    previousFocus instanceof HTMLElement && previousFocus.isConnected &&
                    (!topDialog || topDialog.contains(previousFocus))) previousFocus.focus();
            });
        };
    }, [isExiting, previousFocus, titleId]);

    return createPortal(
        <div
            className={`modal-overlay fixed inset-0 z-50 flex justify-center p-4 ${alignClass} ${className}`.trim()}
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
                ref={content}
                tabIndex={-1}
                className="modal-panel relative z-10 flex w-full justify-center"
                onKeyDown={event => {
                    if (event.key !== 'Tab' || event.defaultPrevented) return;
                    const controls = focusableChildren(event.currentTarget);
                    const first = controls[0], last = controls.at(-1);
                    const active = document.activeElement;
                    if (!first || (event.shiftKey ? active === first : active === last) || active === event.currentTarget) {
                        event.preventDefault();
                        (event.shiftKey ? last : first)?.focus();
                    }
                }}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
