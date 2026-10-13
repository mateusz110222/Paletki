import type {PalletStatus} from '@backend/shared/types';

export function getPalletScanTone(status: PalletStatus, cyclesExceeded: boolean): 'success' | 'warning' | 'error' {
    if (status === 'Blocked' || status === 'Damaged') return 'error';
    if (status === 'Washing_Required' || cyclesExceeded) return 'warning';
    return 'success';
}
