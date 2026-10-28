import { useState, type FormEvent } from 'react';
import { CheckCircle2, Coins, HandCoins, Send, XCircle } from 'lucide-react';
import { useAsync, useCourierWallet, useMyWallet } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { Payout } from '../../api/types';
import { useSession } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import { WalletHero } from '../../components/WalletHero';
import { Modal } from '../../components/Modal';
import { Banner, EmptyState, ErrorState, Loading, PageHeader, Pagination, Panel, PayoutPill, RefreshButton, SettlementPill, Spinner } from '../../components/ui';
import { dateTime, errorMessage, money, toNumber } from '../../lib/format';

const PAGE_SIZE = 10;

export function CourierWallet() {
  const { user } = useSession();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Commission payout request modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [confirmingPayoutId, setConfirmingPayoutId] = useState<string | null>(null);
  const [rejectingPayout, setRejectingPayout] = useState<Payout | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const wallet = useMyWallet();
  const courierWallet = useCourierWallet();
  // Settlement.courierId is the courier's User id; the API doesn't scope by role.
  const history = useAsync(() => Api.settlements.list({ courierId: user.id, page, pageSize: PAGE_SIZE }), [user.id, page]);
  // All pending requests (not just this page) so we don't let the courier over-commit.
  const pending = useAsync(() => Api.settlements.list({ courierId: user.id, status: 'PENDING', pageSize: 100 }), [user.id]);
  const payouts = useAsync(() => Api.payouts.list({ pageSize: 50 }), [user.id]);

  const balance = toNumber(courierWallet.data?.cashInHand ?? wallet.data?.balance);
  const pendingTotal = (pending.data?.settlements ?? []).reduce((s, x) => s + toNumber(x.amount), 0);
  const available = Math.max(0, balance - pendingTotal);

  const pendingCommission = toNumber(courierWallet.data?.pendingPayout ?? 0);
  const pendingPayoutTotal = (payouts.data?.payouts ?? [])
    .filter((p) => p.status === 'PENDING' || p.status === 'DISBURSED')
    .reduce((sum, p) => sum + toNumber(p.amount), 0);
  const availableCommission = Math.max(0, pendingCommission - pendingPayoutTotal);
  const hasUnsettledCash = balance > 0;
  const canRequestPayout = availableCommission > 0 && !hasUnsettledCash;

  const hasWallet = (wallet.data !== null && wallet.data !== undefined) || (courierWallet.data !== null && courierWallet.data !== undefined);

  const refresh = () => {
    wallet.reload();
    courierWallet.reload();
    history.reload();
    pending.reload();
    payouts.reload();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setFormError('Enter an amount greater than zero.');
    if (value > available + 1e-9) return setFormError(`You can settle at most ${money(available)} right now.`);

    setBusy(true);
    try {
      await Api.settlements.initiate({ courierId: user.id, amount: Math.round(value * 100) / 100, notes: notes.trim() || undefined });
      toast.success('Settlement started', `Hand ${money(value)} to the hub admin to have it confirmed.`);
      setAmount('');
      setNotes('');
      setPage(1);
      refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitPayout = async (e: FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    if (hasUnsettledCash) {
      return setPayoutError(`You must hand over and confirm your collected cash (${money(balance)}) with the hub first.`);
    }
    const value = Number(payoutAmount);
    if (!Number.isFinite(value) || value <= 0) return setPayoutError('Enter an amount greater than zero.');
    if (value > availableCommission + 1e-9) {
      return setPayoutError(`You can withdraw at most ${money(availableCommission)} right now.`);
    }

    setPayoutBusy(true);
    try {
      await Api.payouts.request({ amount: Math.round(value * 100) / 100, notes: payoutNotes.trim() || undefined });
      toast.success('Payout requested', `Your request for ${money(value)} has been sent to the hub.`);
      setShowPayoutModal(false);
      setPayoutAmount('');
      setPayoutNotes('');
      refresh();
    } catch (err) {
      setPayoutError(errorMessage(err));
    } finally {
      setPayoutBusy(false);
    }
  };

  const confirmPayout = async (payoutId: string, amountVal: string) => {
    setConfirmingPayoutId(payoutId);
    try {
      await Api.payouts.confirm(payoutId);
      toast.success('Receipt confirmed', `You confirmed receiving ${money(amountVal)}. Commission account zeroed/updated.`);
      refresh();
    } catch (err) {
      toast.error('Confirmation failed', errorMessage(err));
    } finally {
      setConfirmingPayoutId(null);
    }
  };

  const submitRejectPayout = async () => {
    if (!rejectingPayout) return;
    setRejectBusy(true);
    try {
      await Api.payouts.reject(rejectingPayout.id, rejectReason.trim() || undefined);
      toast.warning('Payout rejected', `Rejected payout of ${money(rejectingPayout.amount)}.`);
      setRejectingPayout(null);
      setRejectReason('');
      refresh();
    } catch (err) {
      toast.error('Rejection failed', errorMessage(err));
    } finally {
      setRejectBusy(false);
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Cash handover"
        title="Wallet & settlement"
        subtitle="Your wallet holds the COD you've collected. Start a settlement when you hand cash to the hub; it clears once an admin confirms."
        actions={<RefreshButton onClick={refresh} loading={wallet.loading || history.loading} />}
      />

      <div className="grid-main">
        <WalletHero
          wallet={wallet.data}
          loading={wallet.loading && courierWallet.loading}
          error={wallet.error}
          label="Cash on hand · owed to hub"
          meta={[
            { label: 'Available to settle', value: money(available) },
            { label: 'Awaiting confirmation', value: money(pendingTotal) },
            {
              label: 'Commission owed to you',
              value: <span style={{ color: 'var(--green)' }}>{money(courierWallet.data?.pendingPayout ?? 0)}</span>,
            },
            { label: 'Lifetime earnings', value: money(courierWallet.data?.totalEarnings ?? 0) },
          ]}
        >
          <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ background: 'var(--green)', borderColor: 'var(--green)', color: '#000', fontWeight: 600 }}
              onClick={() => {
                setPayoutAmount(availableCommission.toFixed(2));
                setShowPayoutModal(true);
              }}
              disabled={!canRequestPayout}
              title={hasUnsettledCash ? `Settle your collected cash (${money(balance)}) with the hub first` : undefined}
            >
              <Coins size={14} style={{ marginRight: 4 }} />
              Request commission payout ({money(availableCommission)})
            </button>
            {hasUnsettledCash && (
              <span className="hint" style={{ color: 'var(--gold)' }}>
                Must settle & confirm collected cash ({money(balance)}) with the hub before withdrawing commission.
              </span>
            )}
          </div>
        </WalletHero>

        <Panel title="Start a settlement" subtitle="Declare the cash you're handing over">
          <form className="panel-body stack-sm" onSubmit={submit} noValidate>
            {!hasWallet && !wallet.loading ? (
              <Banner tone="gold" title="No wallet yet">You need a wallet before you can settle cash.</Banner>
            ) : (
              <>
                <div className="field">
                  <label className="label" htmlFor="settle-amount">Amount</label>
                  <div className="input-wrap has-prefix has-action">
                    <span className="input-prefix">EGP</span>
                    <input
                      id="settle-amount"
                      className="input"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder={available.toFixed(2)}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={available <= 0}
                    />
                    <button type="button" className="btn btn-ghost btn-sm input-action" style={{ width: 'auto', padding: '0 10px' }} onClick={() => setAmount(available.toFixed(2))} disabled={available <= 0}>
                      Max
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label className="label" htmlFor="settle-notes">Notes <span className="opt">(optional)</span></label>
                  <textarea id="settle-notes" className="textarea" placeholder="e.g. End of shift — 6 deliveries" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {formError && <Banner tone="rose">{formError}</Banner>}
                {available <= 0 && !wallet.loading && (
                  <span className="hint">{pendingTotal > 0 ? 'All your cash is already in a pending settlement.' : 'Nothing to settle — deliver parcels to collect COD.'}</span>
                )}
                <button id="start-settlement-btn" type="submit" className="btn btn-primary btn-block" disabled={busy || available <= 0}>
                  {busy ? <Spinner size={14} /> : <Send size={16} />} Start settlement
                </button>
              </>
            )}
          </form>
        </Panel>
      </div>

      <Panel
        title="Settlement history"
        footer={history.data && <Pagination page={history.data.page} totalPages={history.data.totalPages} total={history.data.total} pageSize={history.data.pageSize} onChange={setPage} noun="settlements" />}
      >
        {history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : !history.data ? (
          <Loading />
        ) : history.data.settlements.length === 0 ? (
          <EmptyState icon={HandCoins} title="No settlements yet" message="Settlements you start will be tracked here until the hub confirms them." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {history.data.settlements.map((s) => (
                  <tr key={s.id}>
                    <td className="nowrap muted">{dateTime(s.createdAt)}</td>
                    <td className="num nowrap cell-main">{money(s.amount)}</td>
                    <td><SettlementPill status={s.status} /></td>
                    <td><div className="truncate muted" title={s.notes ?? ''}>{s.notes || <span className="faint">—</span>}</div></td>
                    <td className="nowrap muted">
                      {s.confirmedAt ? dateTime(s.confirmedAt) : '—'}
                      {s.admin?.name && <div className="cell-sub">by {s.admin.name}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {courierWallet.data && courierWallet.data.transactions.length > 0 && (
        <Panel title="Wallet activity & commissions" subtitle="Ledger entries for deliveries, earnings, and deposits">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activity</th>
                  <th className="num">Amount</th>
                  <th className="num">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {courierWallet.data.transactions.map((t) => {
                  const isCommission = t.type === 'COMMISSION_EARNED';
                  const label =
                    t.type === 'COMMISSION_EARNED'
                      ? 'Commission earned'
                      : t.type === 'CASH_COLLECTED'
                      ? 'COD collected'
                      : t.type === 'CASH_DEPOSITED'
                      ? 'Cash handed to hub'
                      : t.type === 'PAYOUT_SETTLED'
                      ? 'Payout settled'
                      : 'Opening balance';

                  return (
                    <tr key={t.id}>
                      <td className="nowrap muted">{dateTime(t.createdAt)}</td>
                      <td>
                        <span className={`pill ${isCommission ? 'tone-green' : 'tone-slate'}`}>
                          <span className="pill-dot" />
                          {label}
                        </span>
                      </td>
                      <td className="num nowrap cell-main" style={{ color: isCommission ? 'var(--green)' : undefined }}>
                        {isCommission ? `+${money(t.amount)}` : money(t.amount)}
                      </td>
                      <td className="num nowrap muted">{money(t.balanceAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel
        title="Commission payouts & withdrawals"
        subtitle="Withdraw your earned commission. Once the hub disburses, confirm receipt here to zero/update your account."
        actions={
          <button
            type="button"
            className="btn btn-sm btn-tone tone-green"
            onClick={() => {
              setPayoutAmount(availableCommission.toFixed(2));
              setShowPayoutModal(true);
            }}
            disabled={!canRequestPayout}
            title={hasUnsettledCash ? `Settle your collected cash (${money(balance)}) with the hub first` : undefined}
          >
            <Coins size={14} /> Request payout
          </button>
        }
      >
        {hasUnsettledCash && availableCommission > 0 && (
          <div style={{ padding: '16px 20px 0' }}>
            <Banner tone="gold" title="Settle collected COD first">
              You currently hold <b>{money(balance)}</b> in collected COD cash. Please hand over and have the hub confirm your cash settlement before requesting a commission payout.
            </Banner>
          </div>
        )}
        {payouts.error ? (
          <ErrorState message={payouts.error} onRetry={payouts.reload} />
        ) : !payouts.data ? (
          <Loading />
        ) : payouts.data.payouts.length === 0 ? (
          <EmptyState
            icon={Coins}
            title="No payout requests yet"
            message="When you have earned commission, you can request to withdraw it here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Disbursed</th>
                  <th className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {payouts.data.payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap muted">{dateTime(p.createdAt)}</td>
                    <td className="num nowrap cell-main" style={{ color: 'var(--green)' }}>
                      {money(p.amount)}
                    </td>
                    <td><PayoutPill status={p.status} /></td>
                    <td><div className="truncate muted" title={p.notes ?? ''}>{p.notes || <span className="faint">—</span>}</div></td>
                    <td className="nowrap muted">
                      {p.disbursedAt ? dateTime(p.disbursedAt) : '—'}
                      {p.admin?.name && <div className="cell-sub">by {p.admin.name}</div>}
                    </td>
                    <td className="num nowrap">
                      {p.status === 'DISBURSED' ? (
                        <div className="cell-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-tone tone-rose"
                            disabled={confirmingPayoutId === p.id}
                            onClick={() => {
                              setRejectReason('');
                              setRejectingPayout(p);
                            }}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={confirmingPayoutId === p.id}
                            onClick={() => confirmPayout(p.id, p.amount)}
                          >
                            {confirmingPayoutId === p.id ? <Spinner size={13} /> : <CheckCircle2 size={14} />}
                            Confirm receipt
                          </button>
                        </div>
                      ) : p.status === 'PENDING' ? (
                        <div className="cell-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            style={{ color: 'var(--rose)' }}
                            onClick={() => {
                              setRejectReason('');
                              setRejectingPayout(p);
                            }}
                          >
                            <XCircle size={14} /> Cancel
                          </button>
                        </div>
                      ) : p.status === 'CONFIRMED' ? (
                        <span className="pill tone-green"><span className="pill-dot" /> Received</span>
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showPayoutModal && (
        <Modal
          open
          busy={payoutBusy}
          title="Withdraw earned commission"
          subtitle={`Available to withdraw: ${money(availableCommission)}`}
          onClose={() => setShowPayoutModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowPayoutModal(false)} disabled={payoutBusy}>
                Cancel
              </button>
              <button type="submit" form="payout-form" className="btn btn-primary" disabled={payoutBusy || availableCommission <= 0}>
                {payoutBusy ? <Spinner size={14} /> : <Send size={15} />} Submit payout request
              </button>
            </>
          }
        >
          <form id="payout-form" className="stack-sm" onSubmit={submitPayout} noValidate>
            <div className="field">
              <label className="label" htmlFor="payout-amount">Amount</label>
              <div className="input-wrap has-prefix has-action">
                <span className="input-prefix">EGP</span>
                <input
                  id="payout-amount"
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step="0.01"
                  max={availableCommission}
                  placeholder={availableCommission.toFixed(2)}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  disabled={availableCommission <= 0}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm input-action"
                  style={{ width: 'auto', padding: '0 10px' }}
                  onClick={() => setPayoutAmount(availableCommission.toFixed(2))}
                  disabled={availableCommission <= 0}
                >
                  Max (Zero Out)
                </button>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="payout-notes">Payment details / Notes <span className="opt">(optional)</span></label>
              <textarea
                id="payout-notes"
                className="textarea"
                placeholder="e.g. Cash at hub / Instapay: 010xxxxxxxx"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
              />
            </div>
            {payoutError && <Banner tone="rose">{payoutError}</Banner>}
          </form>
        </Modal>
      )}

      {rejectingPayout && (
        <Modal
          open
          busy={rejectBusy}
          title={rejectingPayout.status === 'PENDING' ? 'Cancel payout request' : 'Reject payout'}
          subtitle={`Amount: ${money(rejectingPayout.amount)}`}
          onClose={() => setRejectingPayout(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setRejectingPayout(null)} disabled={rejectBusy}>
                Close
              </button>
              <button type="button" className="btn btn-tone tone-rose" onClick={submitRejectPayout} disabled={rejectBusy}>
                {rejectBusy ? <Spinner size={14} /> : <XCircle size={15} />} Confirm reject
              </button>
            </>
          }
        >
          <div className="stack-sm">
            <div className="field">
              <label className="label" htmlFor="reject-payout-reason">Reason <span className="opt">(optional)</span></label>
              <textarea
                id="reject-payout-reason"
                className="textarea"
                autoFocus
                placeholder="e.g. Amount mismatch / Did not receive transfer"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
