import type {ReactNode} from 'react';
import {useTranslation} from '../i18n/LanguageContext';

export function SelectedPalletList<Row extends {pallet_id: string}>({pallets, statusLabel, renderStatus}: {
    pallets: readonly Row[];
    statusLabel: string;
    renderStatus: (pallet: Row) => ReactNode;
}) {
    const {t} = useTranslation();
    return <div tabIndex={0} role="region" aria-label={t('col_pallet_id')}
        className="max-h-44 overflow-auto overscroll-contain rounded-lg border border-brand-border bg-brand-bg focus-visible:outline-2 focus-visible:outline-brand-accent">
        <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 z-10 bg-brand-bg text-xs text-brand-text-muted">
                <tr>
                    <th scope="col" className="w-1/2 px-3 py-2 text-left font-medium shadow-[inset_0_-1px_var(--color-brand-border)]">{t('col_pallet_id')}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium shadow-[inset_0_-1px_var(--color-brand-border)]">{statusLabel}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60">
                {pallets.map(pallet => <tr key={pallet.pallet_id}>
                    <th scope="row" className="wrap-anywhere px-3 py-2 text-left font-mono text-xs font-semibold text-brand-text">{pallet.pallet_id}</th>
                    <td className="wrap-anywhere px-3 py-2 text-right">{renderStatus(pallet)}</td>
                </tr>)}
            </tbody>
        </table>
    </div>;
}
