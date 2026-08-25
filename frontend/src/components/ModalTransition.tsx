import React, {type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {motion, useReducedMotion} from 'motion/react';

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
    const reduceMotion = useReducedMotion();

    return createPortal(
        <motion.div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: reduceMotion ? 0.01 : 0.18, ease: 'easeOut'}}
        >
            <motion.div
                className={`fixed inset-0 ${backdropClassName}`}
                onClick={onBackdropClick}
                aria-hidden="true"
            />
            <motion.div
                className="relative z-10 flex w-full justify-center"
                initial={reduceMotion ? {opacity: 0} : {opacity: 0, y: 22, scale: 0.965}}
                animate={{opacity: 1, y: 0, scale: 1}}
                exit={reduceMotion ? {opacity: 0} : {opacity: 0, y: 12, scale: 0.975}}
                transition={reduceMotion
                    ? {duration: 0.01}
                    : {type: 'spring', stiffness: 420, damping: 34, mass: 0.75}}
            >
                {children}
            </motion.div>
        </motion.div>,
        document.body,
    );
}
