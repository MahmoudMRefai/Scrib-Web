import { useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, Banknote, CheckCircle2, Coins, Flag, HandCoins, Send, XCircle } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { Payout, PayoutRecipientType, PayoutStatus, RecipientPayoutBalance, Settlement, SettlementStatus } from '../../api/types';
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
  PayoutPill,
  RefreshButton,
  SettlementPill,
  Spinner,
} from '../../components/ui';
import { dateTime, errorMessage, money, toNumber } from '../../lib/format';

const PAGE_SIZE = 15;
type Filter = SettlementStatus | 'ALL';

export function AdminSettlements({ onChange }: { onChange: () => void }) {
  const [tab, setTab] = useState<'HANDOVERS' | 'PAYOUTS'>('HANDOVERS');
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<Settlement | null>(null);
  const [disputing, setDisputing] = useState<Settlement | null>(null);

  // Payouts state
  const [payoutFilter, setPayoutFilter] = useState<PayoutStatus | 'ALL'>('PENDING');
  const [payoutPage, setPayoutPage] = useState(1);
  const [disbursing, setDisbursing] = useState<Payout | null>(null);
  const [rejectingPayout, setRejectingPayout] = useState<Payout | null>(null);
  const [showSendPayout, setShowSendPayout] = useState(false);

  const list = useAsync(
    () => Api.settlements.list({ status: filter === 'ALL' ? undefined : filter, page, pageSize: PAGE_SIZE }),
    [filter, page],
  );

  const payoutList = useAsync(
    () => Api.payouts.list({ status: payoutFilter === 'ALL' ? undefined : payoutFilter, page: payoutPage, pageSize: PAGE_SIZE }),
    [payoutFilter, payoutPage],
  );

  const recipientBalances = useAsync(() => Api.payouts.balances(), []);

  // Courier balances, so the admin can sanity-check before confirming.
  const wallets = useAsync(() => Api.wallets.list({ ownerType: 'COURIER' }), []);
  const balanceByCourier = useMemo(
    () => new Map((wallets.data ?? []).filter((w) => w.type === 'ASSET').map((w) => [w.ownerId, toNumber(w.balance)])),
    [wallets.data],
  );

  const refresh = () => {
    list.reload();
    payoutList.reload();
    recipientBalances.reload();
    wallets.reload();
    onChange();
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Financial Hub"
        title="Settlements & Payouts"
        subtitle={
          tab === 'HANDOVERS'
            ? "Confirm physical COD cash received from couriers at the hub."
            : "Review withdrawal requests from couriers and merchants, disburse funds, and track recipient confirmations."
        }
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <RefreshButton onClick={refresh} loading={list.loading || payoutList.loading} />
            {tab === 'PAYOUTS' && (
              <button type="button" className="btn btn-primary" onClick={() => setShowSendPayout(true)}>
                <Send size={15} /> Send payout
              </button>
            )}
          </div>
        }
      />

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'HANDOVERS' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('HANDOVERS')}
        >
          <HandCoins size={15} style={{ marginRight: 6 }} /> Cash handovers (Couriers → Hub)
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'PAYOUTS' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('PAYOUTS')}
        >
          <ArrowUpRight size={15} style={{ marginRight: 6 }} /> Payouts (Hub → Couriers & Merchants)
        </button>
      </div>

      {tab === 'HANDOVERS' ? (
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
      ) : (
        <Panel
          title={
            <FilterChips
              idPrefix="payout-filter"
              value={payoutFilter}
              onChange={(v) => {
                setPayoutFilter(v);
                setPayoutPage(1);
              }}
              options={[
                { value: 'PENDING', label: 'Requested' },
                { value: 'DISBURSED', label: 'Disbursed (Awaiting recipient)' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'REJECTED', label: 'Rejected' },
                { value: 'ALL', label: 'All' },
              ]}
            />
          }
          actions={
            <button type="button" className="btn btn-sm btn-tone tone-green" onClick={() => setShowSendPayout(true)}>
              <Send size={14} /> Send direct payout
            </button>
          }
          footer={
            payoutList.data && (
              <Pagination page={payoutList.data.page} totalPages={payoutList.data.totalPages} total={payoutList.data.total} pageSize={payoutList.data.pageSize} onChange={setPayoutPage} noun="payouts" />
            )
          }
        >
          {payoutList.error ? (
            <ErrorState message={payoutList.error} onRetry={payoutList.reload} />
          ) : !payoutList.data ? (
            <Loading label="Loading payouts…" />
          ) : payoutList.data.payouts.length === 0 ? (
            <EmptyState
              icon={Coins}
              title={payoutFilter === 'PENDING' ? 'No pending payout requests' : 'No payouts found'}
              message="Withdrawal requests from merchants and couriers appear here, or send a direct payout above."
              action={
                <button type="button" className="btn btn-primary" onClick={() => setShowSendPayout(true)}>
                  <Send size={15} /> Send payout
                </button>
              }
            />
          ) : (
            <div className="table-wrap" style={{ opacity: payoutList.loading ? 0.6 : 1 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Requested</th>
                    <th>Disbursed</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutList.data.payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="cell-main nowrap">
                        {p.recipient?.name ?? '—'}
                        <div className="cell-sub">{p.recipient?.email}</div>
                      </td>
                      <td>
                        <span className={`pill ${p.recipientType === 'COURIER' ? 'tone-teal' : 'tone-violet'}`}>
                          {p.recipientType}
                        </span>
                      </td>
                      <td className="num nowrap cell-main" style={{ color: 'var(--green)' }}>
                        {money(p.amount)}
                      </td>
                      <td><PayoutPill status={p.status} /></td>
                      <td><div className="truncate muted" title={p.notes ?? ''}>{p.notes || <span className="faint">—</span>}</div></td>
                      <td className="nowrap muted">{dateTime(p.createdAt)}</td>
                      <td className="nowrap muted">
                        {p.disbursedAt ? dateTime(p.disbursedAt) : '—'}
                        {p.admin?.name && <div className="cell-sub">by {p.admin.name}</div>}
                      </td>
                      <td>
                        <div className="cell-actions">
                          {p.status === 'PENDING' ? (
                            <>
                              <button className="btn btn-sm btn-tone tone-rose" onClick={() => setRejectingPayout(p)}>
                                <XCircle size={14} /> Reject
                              </button>
                              <button className="btn btn-sm btn-primary" onClick={() => setDisbursing(p)}>
                                <Send size={14} /> Disburse
                              </button>
                            </>
                          ) : p.status === 'DISBURSED' ? (
                            <span className="pill tone-sky">Awaiting recipient</span>
                          ) : (
                            <span className="faint" style={{ fontSize: '0.8125rem' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <ConfirmDialog settlement={confirming} courierBalance={confirming ? balanceByCourier.get(confirming.courierId) : undefined} onClose={() => setConfirming(null)} onDone={refresh} />
      <DisputeDialog settlement={disputing} onClose={() => setDisputing(null)} onDone={refresh} />
      <DisburseDialog payout={disbursing} onClose={() => setDisbursing(null)} onDone={refresh} />
      <RejectPayoutDialog payout={rejectingPayout} onClose={() => setRejectingPayout(null)} onDone={refresh} />
      <SendPayoutDialog
        open={showSendPayout}
        couriers={recipientBalances.data?.couriers ?? []}
        merchants={recipientBalances.data?.merchants ?? []}
        onClose={() => setShowSendPayout(false)}
        onDone={refresh}
      />
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

function DisburseDialog({ payout, onClose, onDone }: { payout: Payout | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  if (!payout) return null;

  const close = () => {
    setNotes('');
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    try {
      await Api.payouts.disburse(payout.id, notes.trim());
      toast.success('Funds disbursed', `Marked ${money(payout.amount)} as disbursed to ${payout.recipient?.name ?? 'recipient'}. Awaiting their confirmation.`);
      onDone();
      close();
    } catch (e) {
      toast.error('Disbursement failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      busy={busy}
      onClose={close}
      title="Disburse payout"
      subtitle={`To ${payout.recipient?.name ?? 'recipient'} (${payout.recipientType}) · ${money(payout.amount)}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner size={14} /> : <Send size={15} />} Mark as disbursed
          </button>
        </>
      }
    >
      <div className="stack-sm">
        <p className="muted" style={{ fontSize: '0.875rem' }}>
          Hand physical cash to the recipient or send via transfer. Once marked as disbursed, the recipient can confirm receipt from their console to finalize the transaction.
        </p>
        <div className="field">
          <label className="label" htmlFor="disburse-notes">Disbursement notes / Reference <span className="opt">(optional)</span></label>
          <textarea
            id="disburse-notes"
            className="textarea"
            autoFocus
            placeholder="e.g. Paid in cash at hub / Instapay ref: 12345"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

function RejectPayoutDialog({ payout, onClose, onDone }: { payout: Payout | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!payout) return null;

  const close = () => {
    setReason('');
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    try {
      await Api.payouts.reject(payout.id, reason.trim() || undefined);
      toast.warning('Payout rejected', `Rejected payout of ${money(payout.amount)} for ${payout.recipient?.name ?? 'recipient'}.`);
      onDone();
      close();
    } catch (e) {
      toast.error('Reject failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      busy={busy}
      onClose={close}
      title="Reject payout request"
      subtitle={`${payout.recipient?.name ?? 'Recipient'} (${payout.recipientType}) · ${money(payout.amount)}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>Cancel</button>
          <button className="btn btn-tone tone-rose" onClick={submit} disabled={busy}>
            {busy ? <Spinner size={14} /> : <XCircle size={15} />} Reject request
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label" htmlFor="admin-reject-payout-reason">Reason <span className="opt">(optional)</span></label>
        <textarea
          id="admin-reject-payout-reason"
          className="textarea"
          autoFocus
          placeholder="e.g. Incorrect payment details / Requested amount exceeds verified balance"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function SendPayoutDialog({
  open,
  couriers,
  merchants,
  onClose,
  onDone,
}: {
  open: boolean;
  couriers: RecipientPayoutBalance[];
  merchants: RecipientPayoutBalance[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [role, setRole] = useState<PayoutRecipientType>('COURIER');
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const list = role === 'COURIER' ? couriers : merchants;
  const selected = list.find((r) => r.userId === recipientId) ?? null;
  const available = toNumber(selected?.availableBalance ?? 0);

  const close = () => {
    setRecipientId('');
    setAmount('');
    setNotes('');
    setError(null);
    onClose();
  };

  const handleRoleChange = (nextRole: PayoutRecipientType) => {
    setRole(nextRole);
    setRecipientId('');
    setAmount('');
    setError(null);
  };

  const handleRecipientChange = (nextId: string) => {
    setRecipientId(nextId);
    setError(null);
    const nextItem = list.find((r) => r.userId === nextId);
    if (nextItem) {
      const avail = toNumber(nextItem.availableBalance);
      setAmount(avail > 0 ? avail.toFixed(2) : '');
    } else {
      setAmount('');
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!recipientId) return setError('Please select a recipient.');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than zero.');
    if (value > available + 1e-9) return setError(`Recipient has at most ${money(available)} available.`);

    setBusy(true);
    try {
      await Api.payouts.sendDirect({
        recipientId,
        amount: Math.round(value * 100) / 100,
        notes: notes.trim() || undefined,
      });
      toast.success(
        'Payout sent',
        `Sent ${money(value)} to ${selected?.name ?? 'recipient'}. They can now confirm or reject receipt from their console.`,
      );
      onDone();
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      busy={busy}
      onClose={close}
      title="Send payout directly"
      subtitle="Disburse funds to a courier or merchant without waiting for them to request first. They will confirm or reject receipt."
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="admin-send-payout-form" className="btn btn-primary" disabled={busy || !recipientId || available <= 0}>
            {busy ? <Spinner size={14} /> : <Send size={15} />} Send & disburse
          </button>
        </>
      }
    >
      <form id="admin-send-payout-form" className="stack-sm" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label">Recipient type</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${role === 'COURIER' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => handleRoleChange('COURIER')}
            >
              Courier (Commission)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${role === 'MERCHANT' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => handleRoleChange('MERCHANT')}
            >
              Merchant (COD Balance)
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="send-payout-recipient">Select {role === 'COURIER' ? 'courier' : 'merchant'}</label>
          <select
            id="send-payout-recipient"
            className="input"
            value={recipientId}
            onChange={(e) => handleRecipientChange(e.target.value)}
          >
            <option value="">— Choose {role.toLowerCase()} —</option>
            {list.map((r) => (
              <option key={r.userId} value={r.userId}>
                {r.name} · Available: {money(r.availableBalance)}
              </option>
            ))}
          </select>
          {selected && (
            <span className="hint">
              Total balance: {money(selected.totalBalance)} · Pending payouts: {money(selected.pendingPayouts)} · Available: {money(selected.availableBalance)}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="send-payout-amount">Amount</label>
          <div className="input-wrap has-prefix has-action">
            <span className="input-prefix">EGP</span>
            <input
              id="send-payout-amount"
              className="input"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              max={available}
              placeholder={available.toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!recipientId || available <= 0}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm input-action"
              style={{ width: 'auto', padding: '0 10px' }}
              onClick={() => setAmount(available.toFixed(2))}
              disabled={!recipientId || available <= 0}
            >
              Max (Zero Out)
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="send-payout-notes">Notes / Reference <span className="opt">(optional)</span></label>
          <textarea
            id="send-payout-notes"
            className="textarea"
            placeholder="e.g. Paid in cash at hub / Instapay ref #12345"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <Banner tone="rose">{error}</Banner>}
      </form>
    </Modal>
  );
}
