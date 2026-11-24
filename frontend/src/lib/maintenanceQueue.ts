import type {Pallet} from '@backend/shared/types';

export const washingSoonRatio = 0.8;
const statusTime = (pallet: Pallet) => Date.parse(pallet.status_changed_at ?? '');
const sortTime = (pallet: Pallet) => Number.isFinite(statusTime(pallet)) ? statusTime(pallet) : Infinity;

export function getMaintenanceQueues(pallets: Pallet[]) {
    const queue = pallets.filter(pallet => pallet.status === 'Damaged' || pallet.status === 'Washing_Required')
        .sort((a, b) => sortTime(a) - sortTime(b) || a.id - b.id);
    return {
        queue,
        repairs: queue.filter(pallet => pallet.status === 'Damaged'),
        routine: queue.filter(pallet => pallet.status === 'Washing_Required'),
        soon: pallets.filter(pallet => pallet.status === 'Active' && pallet.max_cycles > 0
            && pallet.current_cycles >= pallet.max_cycles * washingSoonRatio)
            .sort((a, b) => remainingCycles(a) - remainingCycles(b) || a.id - b.id),
    };
}

export const remainingCycles = (pallet: Pallet) => Math.max(0, pallet.max_cycles - pallet.current_cycles);

export function waitingTime(pallet: Pallet, now: number, language: string): string | undefined {
    const time = statusTime(pallet);
    if (!Number.isFinite(time)) return undefined;
    const minutes = Math.max(0, Math.floor((now - time) / 60_000));
    const unit = minutes >= 1440 ? 'day' : minutes >= 60 ? 'hour' : 'minute';
    const value = Math.floor(minutes / (unit === 'day' ? 1440 : unit === 'hour' ? 60 : 1));
    return new Intl.NumberFormat(language, {style: 'unit', unit, unitDisplay: 'short'}).format(value);
}
