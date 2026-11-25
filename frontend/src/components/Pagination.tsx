import React from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {useTranslation} from '../i18n/LanguageContext';

export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems?: number;
    pageSize?: number;
    pageSizes?: readonly number[];
    onPageSizeChange?: (size: number) => void;
    onPageChange: (page: number) => void;
    className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    totalItems,
    pageSize = 25,
    pageSizes = [25, 50, 100, 200],
    onPageSizeChange,
    onPageChange,
    className = '',
}) => {
    const {t} = useTranslation();

    if (!onPageSizeChange && totalPages <= 1) return null;

    const fromItem = totalItems !== undefined ? Math.min((currentPage - 1) * pageSize + 1, totalItems) : null;
    const toItem = totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : null;

    const getPageNumbers = () => {
        const pages: (number | 'ellipsis')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) {
                pages.push('ellipsis');
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('ellipsis');
            }
            if (!pages.includes(totalPages)) {
                pages.push(totalPages);
            }
        }
        return pages;
    };

    const pages = getPageNumbers();

    return (
        <nav
            className={`flex flex-wrap items-center justify-between gap-3 border-t border-brand-border bg-brand-surface px-3 py-2.5 sm:px-5 ${className}`}
            aria-label={t('pagination_label')}
        >
            <div className="flex items-center gap-3 text-xs font-medium tabular-nums text-brand-text-muted">
                <span>{totalItems === 0 ? t('pagination_empty') : totalItems !== undefined && fromItem !== null && toItem !== null
                    ? t('pagination_showing_range', {from: fromItem, to: toItem, total: totalItems})
                    : `${t('pagination_page')} ${currentPage} ${t('pagination_of')} ${totalPages}`}</span>
                {onPageSizeChange && <select aria-label={t('rows_per_page')} title={t('rows_per_page')}
                    value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}
                    className="h-9 w-24 rounded-lg border border-brand-border bg-brand-bg ps-2.5 text-brand-text">
                    {pageSizes.map(size => <option key={size} value={size}>{size}</option>)}
                </select>}
            </div>

            {totalPages > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        title={t('pagination_previous')}
                        aria-label={t('pagination_previous')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-brand-bg text-brand-text-muted hover:border-brand-accent/40 hover:bg-brand-surface-high hover:text-brand-text disabled:cursor-not-allowed disabled:opacity-40 transition-all active:scale-95"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    {pages.map((p, idx) => {
                        if (p === 'ellipsis') {
                            return (
                                <span
                                    key={idx === 1 ? 'ellipsis-start' : 'ellipsis-end'}
                                    className="px-1 text-xs text-brand-text-muted font-mono"
                                >
                                    …
                                </span>
                            );
                        }

                        const isActive = p === currentPage;
                        return (
                            <button
                                key={p}
                                type="button"
                                onClick={() => onPageChange(p)}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={`${t('pagination_page')} ${p}`}
                                className={`flex h-8 min-w-8 px-2 items-center justify-center rounded-lg text-xs font-mono font-bold transition-all ${
                                    isActive
                                        ? 'bg-brand-accent text-brand-on-accent shadow-sm'
                                        : 'border border-brand-border bg-brand-bg text-brand-text-muted hover:border-brand-accent/40 hover:bg-brand-surface-high hover:text-brand-text'
                                }`}
                            >
                                {p}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        title={t('pagination_next')}
                        aria-label={t('pagination_next')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-brand-bg text-brand-text-muted hover:border-brand-accent/40 hover:bg-brand-surface-high hover:text-brand-text disabled:cursor-not-allowed disabled:opacity-40 transition-all active:scale-95"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </nav>
    );
};
