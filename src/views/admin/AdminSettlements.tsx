import { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Flag, HandCoins } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { Settlement, SettlementStatus } from '../../api/types';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import {
  Banner,
  EmptyState,
  ErrorState,
  FilterChips,
  Loading,
  PageHeader,
  Pagination,
  Panel,
  RefreshButton,
  SettlementPill,
  Spinner,
} from '../../components/ui';
import { dateTime, errorMessage, money, toNumber } from '../../lib/format';

const PAGE_SIZE = 15;
type Filter = SettlementStatus | 'ALL';

export function AdminSettlements({ onChange }: { onChange: () => void }) {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<Settlement | null>(null);
  const [disputing, setDisputing] = useState<Settlement | null>(null);

  const list = useAsync(
    () => Api.settlements.list({ status: filter === 'ALL' ? undefined : filter, page, pageSize: PAGE_SIZE }),
    [filter, page],
  );
  // Courier balances, so the admin can sanity-check before confirming.
  const wallets = useAsync(() => Api.wallets.list({ ownerType: 'COURIER' }), []);
  const balanceByCourier = useMemo(
    () => new Map((wallets.data ?? []).filter((w) => w.type === 'ASSET').map((w) => [w.ownerId, toNumber(w.balance)])),
    [wallets.data],
  );

  const refresh = () => {
    list.reload();
    wallets.reload();
    onChange();
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Cash handover"
        title="Settlements"
        subtitle="Confirm physical cash received from couriers. Confirming debits the courier's wallet and credits hub cash."
        actions={<RefreshButton onClick={refresh} loading={list.loading} />}
      />

      <Panel
        title={
          <FilterChips
            idPrefix="settlement-filter"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            options={[
              { value: 'PENDING', label: 'Awaiting cash' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'DISPUTED', label: 'Disputed' },
              { value: 'ALL', label: 'All' },
            ]}
          />
        }
        footer={
          list.data && (
            <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} pageSize={list.data.pageSize} onChange={setPage} noun="settlements" />
          )
        }
      >
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading label="Loading settlements…" />
        ) : list.data.settlements.length === 0 ? (
          <EmptyState
            icon={filter === 'PENDING' ? CheckCircle2 : HandCoins}
            title={filter === 'PENDING' ? 'Nothing to confirm' : 'No settlements'}
            message={filter === 'PENDING' ? 'Couriers start a settlement from their wallet when they hand over cash.' : undefined}
          />
        ) : (
          <div className="table-wrap" style={{ opacity: list.loading ? 0.6 : 1 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Courier</th>
                  <th className="num">Amount</th>
                  <th className="num">Courier wallet</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Requested</th>
                  <th>Resolved</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data.settlements.map((s) => {
                  const bal = balanceByCourier.get(s.courierId);
                  const short = s.status === 'PENDING' && bal !== undefined && bal < toNumber(s.amount);
                  return (
                    <tr key={s.id}>
                      <td className="cell-main nowrap">{s.courier?.name ?? '—'}</td>
                      <td className="num nowrap cell-main">{money(s.amount)}</td>
                      <td className="num nowrap" style={{ color: short ? 'var(--rose)' : undefined }}>
                        {bal === undefined ? <span className="faint">—</span> : money(bal)}
                      </td>
                      <td><SettlementPill status={s.status} /></td>
                      <td><div className="truncate muted" title={s.notes ?? ''}>{s.notes || <span className="faint">—</span>}</div></td>
                      <td className="nowrap muted">{dateTime(s.createdAt)}</td>
                      <td className="nowrap muted">
                        {s.confirmedAt ? dateTime(s.confirmedAt) : s.status === 'DISPUTED' ? dateTime(s.updatedAt) : '—'}
                        {s.admin?.name && <div className="cell-sub">by {s.admin.name}</div>}
                      </td>
                      <td>
                        <div className="cell-actions">
                          {s.status === 'PENDING' ? (
                            <>
                              <button className="btn btn-sm btn-tone tone-rose" onClick={() => setDisputing(s)} id={`dispute-${s.id}`}>
                                <Flag size={14} /> Dispute
                              </button>
                              <button className="btn btn-sm btn-primary" onClick={() => setConfirming(s)} id={`confirm-${s.id}`}>
                                <CheckCircle2 size={14} /> Confirm
                              </button>
                            </>
                          ) : (
                            <span className="faint" style={{ fontSize: '0.8125rem' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog settlement={confirming} courierBalance={confirming ? balanceByCourier.get(confirming.courierId) : undefined} onClose={() => setConfirming(null)} onDone={refresh} />
      <DisputeDialog settlement={disputing} onClose={() => setDisputing(null)} onDone={refresh} />
    </div>
  );
}

function ConfirmDialog({
  settlement,
  courierBalance,
  onClose,
  onDone,
}: {
  settlement: Settlement | null;
  courierBalance: number | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  if (!settlement) return null;

  const amount = toNumber(settlement.amount);
  const insufficient = courierBalance !== undefined && courierBalance < amount;

  const close = () => {
    setNotes('');
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    try {
      await Api.settlements.confirm(settlement.id, notes.trim());
      toast.success('Cash confirmed', `${money(amount)} received from ${settlement.courier?.name ?? 'courier'}.`);
      onDone();
      close();
    } catch (e) {
      toast.error('Confirmation failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      busy={busy}
      onClose={close}
      title="Confirm cash received"
      subtitle={`From ${settlement.courier?.name ?? 'courier'}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>Cancel</button>
          <button id="confirm-settlement-btn" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner size={14} /> : <CheckCircle2 size={16} />} I've counted {money(amount)}
          </button>
        </>
      }
    >
      <div className="summary">
        <div className="summary-row"><span>Settlement amount</span><b>{money(amount)}</b></div>
        <div className="summary-row"><span>Courier wallet now</span><span>{courierBalance === undefined ? '—' : money(courierBalance)}</span></div>
        <div className="summary-row total">
          <span>Courier wallet after</span>
          <span>{courierBalance === undefined ? '—' : money(courierBalance - amount)}</span>
        </div>
      </div>
      {insufficient && (
        <Banner tone="rose" title="Insufficient courier balance">
          The courier's wallet holds less than this amount, so the backend will reject the confirmation. Consider disputing it.
        </Banner>
      )}
      {settlement.notes && (
        <Banner tone="sky" icon={Banknote} title="Courier note">{settlement.notes}</Banner>
      )}
      <div className="field">
        <label className="label" htmlFor="confirm-notes">Notes <span className="opt">(optional)</span></label>
        <textarea id="confirm-notes" className="textarea" placeholder="e.g. Counted in front of courier, all notes genuine" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

function DisputeDialog({ settlement, onClose, onDone }: { settlement: Settlement | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!settlement) return null;

  const valid = reason.trim().length >= 5;
  const close = () => {
    setReason('');
    onClose();
  };

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await Api.settlements.dispute(settlement.id, reason.trim());
      toast.warning('Settlement disputed', `${settlement.courier?.name ?? 'Courier'} · ${money(settlement.amount)}`);
      onDone();
      close();
    } catch (e) {
      toast.error('Dispute failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      busy={busy}
      onClose={close}
      title="Dispute settlement"
      subtitle={`${settlement.courier?.name ?? 'Courier'} · ${money(settlement.amount)}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>Cancel</button>
          <button id="confirm-dispute-btn" className="btn btn-tone tone-rose" onClick={submit} disabled={!valid || busy}>
            {busy ? <Spinner size={14} /> : <Flag size={16} />} Flag discrepancy
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label" htmlFor="dispute-reason">Reason</label>
        <textarea id="dispute-reason" className="textarea" autoFocus placeholder="e.g. Cash count was 200 EGP short" value={reason} onChange={(e) => setReason(e.target.value)} />
        <span className="hint">At least 5 characters. The courier's wallet is not changed.</span>
      </div>
    </Modal>
  );
}
