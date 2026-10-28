import type { ParcelStatus, SettlementStatus } from '../api/types';

export type Tone = 'gold' | 'teal' | 'violet' | 'sky' | 'rose' | 'green' | 'orange' | 'slate';

export const PARCEL_STATUSES: ParcelStatus[] = [
  'PENDING',
  'PICKED_UP',
  'AT_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED_TO_ORIGIN',
];

/** Mirrors VALID_STATUS_TRANSITIONS in Scribe Core (src/config/constants.ts). */
export const NEXT_STATUS: Record<ParcelStatus, ParcelStatus[]> = {
  PENDING: ['PICKED_UP'],
  PICKED_UP: ['AT_HUB'],
  AT_HUB: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  FAILED: ['RETURNED_TO_ORIGIN', 'OUT_FOR_DELIVERY'],
  DELIVERED: [],
  RETURNED_TO_ORIGIN: [],
};

export const STATUS_META: Record<ParcelStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending', tone: 'slate' },
  PICKED_UP: { label: 'Picked up', tone: 'violet' },
  AT_HUB: { label: 'At hub', tone: 'sky' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'gold' },
  DELIVERED: { label: 'Delivered', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'rose' },
  RETURNED_TO_ORIGIN: { label: 'Returned', tone: 'orange' },
};

export const SETTLEMENT_META: Record<SettlementStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Awaiting cash', tone: 'gold' },
  CONFIRMED: { label: 'Confirmed', tone: 'green' },
  DISPUTED: { label: 'Disputed', tone: 'rose' },
};

export const isTerminal = (s: ParcelStatus) => NEXT_STATUS[s].length === 0;

/** Transitions that have financial or irreversible consequences. */
export const NEEDS_CONFIRMATION: ParcelStatus[] = ['DELIVERED', 'FAILED', 'RETURNED_TO_ORIGIN'];

export function actionLabel(from: ParcelStatus, to: ParcelStatus): string {
  if (from === 'FAILED' && to === 'OUT_FOR_DELIVERY') return 'Retry delivery';
  const labels: Record<ParcelStatus, string> = {
    PENDING: 'Reset to pending',
    PICKED_UP: 'Mark picked up',
    AT_HUB: 'Drop at hub',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Mark delivered',
    FAILED: 'Delivery failed',
    RETURNED_TO_ORIGIN: 'Return to origin',
  };
  return labels[to];
}

export function actionTone(to: ParcelStatus): Tone {
  if (to === 'DELIVERED') return 'green';
  if (to === 'FAILED') return 'rose';
  if (to === 'RETURNED_TO_ORIGIN') return 'orange';
  return STATUS_META[to].tone;
}

/** Progress along the happy path (0–4) and whether the parcel left it. */
export function progressOf(s: ParcelStatus): { step: number; failed: boolean } {
  switch (s) {
    case 'PENDING': return { step: 0, failed: false };
    case 'PICKED_UP': return { step: 1, failed: false };
    case 'AT_HUB': return { step: 2, failed: false };
    case 'OUT_FOR_DELIVERY': return { step: 3, failed: false };
    case 'DELIVERED': return { step: 4, failed: false };
    case 'FAILED':
    case 'RETURNED_TO_ORIGIN': return { step: 4, failed: true };
  }
}
