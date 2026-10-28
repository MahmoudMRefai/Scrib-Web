import { useEffect, useState } from 'react';
import { ArrowRight, Banknote, CircleAlert } from 'lucide-react';
import { Modal } from './Modal';
import { Banner, Spinner, StatusPill } from './ui';
import { useToast } from './Toast';
import { Api } from '../api/endpoints';
import type { Parcel, ParcelStatus } from '../api/types';
import { NEXT_STATUS, STATUS_META, actionLabel } from '../lib/status';
import { errorMessage, money } from '../lib/format';

/**
 * Change a parcel's status. If `target` is given the dialog is a plain
 * confirmation; otherwise the user picks among the valid next statuses.
 */
export function StatusDialog({
  parcel,
  target,
  onClose,
  onDone,
}: {
  parcel: Parcel | null;
  target?: ParcelStatus;
  onClose: () => void;
  onDone: (updated: Parcel) => void;
}) {
  const toast = useToast();
  const options = parcel ? NEXT_STATUS[parcel.status] : [];
  const [choice, setChoice] = useState<ParcelStatus | undefined>(target);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChoice(target ?? (options.length === 1 ? options[0] : undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcel?.id, target]);

  if (!parcel) return null;

  const submit = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      const updated = await Api.parcels.updateStatus(parcel.id, choice);
      toast.success(`${parcel.trackingId} → ${STATUS_META[choice].label}`,
        choice === 'DELIVERED' ? `${money(parcel.codAmount)} COD recorded to the ledger.` : undefined);
      onDone(updated);
      onClose();
    } catch (e) {
      toast.error('Status update failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      busy={busy}
      onClose={onClose}
      title={target ? actionLabel(parcel.status, target) : 'Update parcel status'}
      subtitle={
        <>
          <span className="mono">{parcel.trackingId}</span> · {parcel.recipientName}
        </>
      }
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button id="confirm-status-btn" className="btn btn-primary" onClick={submit} disabled={!choice || busy}>
            {busy ? <Spinner size={14} /> : <ArrowRight size={16} />}
            {choice ? actionLabel(parcel.status, choice) : 'Choose a status'}
          </button>
        </>
      }
    >
      <div className="row">
        <StatusPill status={parcel.status} />
        <ArrowRight size={16} className="faint" />
        {choice ? <StatusPill status={choice} /> : <span className="faint">…</span>}
      </div>

      {!target && (
        <div className="option-list">
          {options.map((s) => (
            <button
              key={s}
              className={`option ${choice === s ? 'selected' : ''}`}
              onClick={() => setChoice(s)}
              id={`status-option-${s.toLowerCase()}`}
            >
              <StatusPill status={s} />
              <span className="muted" style={{ fontSize: '0.875rem' }}>
                {actionLabel(parcel.status, s)}
              </span>
              <span className="option-radio" />
            </button>
          ))}
        </div>
      )}

      {choice === 'DELIVERED' && (
        <Banner tone="green" icon={Banknote} title={`Collect ${money(parcel.codAmount)} in cash`}>
          Marking this delivered records the COD in the ledger: the courier's wallet is credited and the merchant's
          payout is booked. This can't be undone.
        </Banner>
      )}
      {choice === 'FAILED' && (
        <Banner tone="rose" icon={CircleAlert} title="Delivery attempt failed">
          The parcel can then be retried or returned to the merchant.
        </Banner>
      )}
      {choice === 'RETURNED_TO_ORIGIN' && (
        <Banner tone="orange" icon={CircleAlert} title="Return to merchant">
          This closes the parcel. No COD will be collected.
        </Banner>
      )}
    </Modal>
  );
}
