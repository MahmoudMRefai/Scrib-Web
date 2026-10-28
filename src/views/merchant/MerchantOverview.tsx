import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Clock, Coins, HandCoins, Package, PackagePlus, Send, Truck, XCircle } from 'lucide-react';
import { useAsync, useMyWallet, useStatusCounts } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { Merchant, Payout } from '../../api/types';
import { EmptyState, ErrorState, Loading, PageHeader, Panel, PayoutPill, RefreshButton, Spinner, StatCard, StatusPill, Banner } from '../../components/ui';
import { WalletHero } from '../../components/WalletHero';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { count, dateTime, errorMessage, money, timeAgo, toNumber } from '../../lib/format';
import type { MerchantTab } from './MerchantView';

export function MerchantOverview({
  merchant,
  onNavigate,
  onNewParcel,
}: {
  merchant: Merchant;
  onNavigate: (t: MerchantTab) => void;
  onNewParcel: () => void;
}) {
  const toast = useToast();
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingPayout, setRejectingPayout] = useState<Payout | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const wallet = useMyWallet();
  const stats = useStatusCounts({ merchantId: merchant.id });
  const recent = useAsync(() => Api.parcels.list({ merchantId: merchant.id, pageSize: 6 }), [merchant.id]);
  const payouts = useAsync(() => Api.payouts.list({ pageSize: 50 }), [merchant.userId]);

  const balance = toNumber(wallet.data?.balance);
  const pendingPayoutTotal = (payouts.data?.payouts ?? [])
    .filter((p) => p.status === 'PENDING' || p.status === 'DISBURSED')
    .reduce((sum, p) => sum + toNumber(p.amount), 0);
  const available = Math.max(0, balance - pendingPayoutTotal);

  const c = stats.data?.counts;
  const inTransit = c ? c.PICKED_UP + c.AT_HUB + c.OUT_FOR_DELIVERY : 0;
  const loadingStats = stats.loading && !stats.data;

  const refresh = () => {
    wallet.reload();
    stats.reload();
    recent.reload();
    payouts.reload();
  };

  const submitPayout = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than zero.');
    if (value > available + 1e-9) return setError(`You can withdraw at most ${money(available)} right now.`);

    setBusy(true);
    try {
      await Api.payouts.request({ amount: Math.round(value * 100) / 100, notes: notes.trim() || undefined });
      toast.success('Payout requested', `Your request for ${money(value)} has been submitted.`);
      setShowPayoutModal(false);
      setAmount('');
      setNotes('');
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmReceipt = async (payoutId: string, amountVal: string) => {
    setConfirmingId(payoutId);
    try {
      await Api.payouts.confirm(payoutId);
      toast.success('Receipt confirmed', `You confirmed receiving ${money(amountVal)}. Account balance updated.`);
      refresh();
    } catch (err) {
      toast.error('Confirmation failed', errorMessage(err));
    } finally {
      setConfirmingId(null);
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
        eyebrow={merchant.businessName}
        title="Merchant dashboard"
        subtitle="Your shipments and payouts at the Armant hub."
        actions={
          <>
            <RefreshButton onClick={refresh} loading={stats.loading} />
            <button id="new-parcel-btn" className="btn btn-primary" onClick={onNewParcel}>
              <PackagePlus size={16} /> New parcel
            </button>
          </>
        }
      />

      <WalletHero
        wallet={wallet.data}
        loading={wallet.loading}
        error={wallet.error}
        label="Payout balance"
        meta={[
          { label: 'Available to withdraw', value: money(available) },
          { label: 'Pending payout', value: money(pendingPayoutTotal) },
          { label: 'Flat delivery fee', value: money(merchant.flatDeliveryFee) },
        ]}
      >
        <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setAmount(available.toFixed(2));
              setShowPayoutModal(true);
            }}
            disabled={available <= 0}
          >
            <Coins size={14} style={{ marginRight: 4 }} />
            Request payout ({money(available)})
          </button>
          <span className="hint">Credited with COD minus the delivery fee each time a parcel is delivered.</span>
        </div>
      </WalletHero>

      {stats.error && <Panel><ErrorState message={stats.error} onRetry={stats.reload} /></Panel>}

      <div className="stats">
        <StatCard label="Total parcels" value={count(stats.data?.total ?? 0)} icon={Package} tone="violet" loading={loadingStats} />
        <StatCard label="Awaiting pickup" value={count(c?.PENDING ?? 0)} icon={Clock} tone="slate" loading={loadingStats} />
        <StatCard label="In transit" value={count(inTransit)} icon={Truck} tone="gold" loading={loadingStats} />
        <StatCard
          label="Delivered"
          value={count(c?.DELIVERED ?? 0)}
          icon={CheckCircle2}
          tone="green"
          loading={loadingStats}
          hint={c ? `${count(c.FAILED + c.RETURNED_TO_ORIGIN)} failed or returned` : undefined}
        />
      </div>

      <Panel
        title="Recent parcels"
        actions={
          <button className="btn btn-sm btn-ghost" onClick={() => onNavigate('parcels')}>
            View all <ArrowRight size={14} />
          </button>
        }
      >
        {recent.error ? (
          <ErrorState message={recent.error} onRetry={recent.reload} />
        ) : !recent.data ? (
          <Loading />
        ) : recent.data.parcels.length === 0 ? (
          <EmptyState
            icon={PackagePlus}
            title="Ship your first parcel"
            message="Create a parcel and the hub will assign a courier to pick it up."
            action={<button className="btn btn-primary" onClick={onNewParcel}><PackagePlus size={16} /> New parcel</button>}
          />
        ) : (
          <div className="list">
            {recent.data.parcels.map((p) => (
              <div key={p.id} className="list-item">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mono cell-main">{p.trackingId}</div>
                  <div className="cell-sub">
                    {p.recipientName} · {p.courier?.name ? `with ${p.courier.name}` : 'no courier yet'} · {timeAgo(p.createdAt)}
                  </div>
                </div>
                <div className="num nowrap cell-main">{money(p.codAmount)}</div>
                <StatusPill status={p.status} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Payout requests & settlements"
        subtitle="Withdraw your COD earnings. Once the hub disburses funds, confirm receipt here to update your balance."
        actions={
          <button
            type="button"
            className="btn btn-sm btn-tone tone-green"
            onClick={() => {
              setAmount(available.toFixed(2));
              setShowPayoutModal(true);
            }}
            disabled={available <= 0}
          >
            <Coins size={14} /> Request payout
          </button>
        }
      >
        {payouts.error ? (
          <ErrorState message={payouts.error} onRetry={payouts.reload} />
        ) : !payouts.data ? (
          <Loading />
        ) : payouts.data.payouts.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No payout requests yet"
            message="When parcels are delivered and COD is credited, you can request a payout here."
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
                            disabled={confirmingId === p.id}
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
                            disabled={confirmingId === p.id}
                            onClick={() => confirmReceipt(p.id, p.amount)}
                          >
                            {confirmingId === p.id ? <Spinner size={13} /> : <CheckCircle2 size={14} />}
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
          busy={busy}
          title="Request payout"
          subtitle={`Available to withdraw: ${money(available)}`}
          onClose={() => setShowPayoutModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowPayoutModal(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" form="merchant-payout-form" className="btn btn-primary" disabled={busy || available <= 0}>
                {busy ? <Spinner size={14} /> : <Send size={15} />} Submit request
              </button>
            </>
          }
        >
          <form id="merchant-payout-form" className="stack-sm" onSubmit={submitPayout} noValidate>
            <div className="field">
              <label className="label" htmlFor="merchant-payout-amount">Amount</label>
              <div className="input-wrap has-prefix has-action">
                <span className="input-prefix">EGP</span>
                <input
                  id="merchant-payout-amount"
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step="0.01"
                  max={available}
                  placeholder={available.toFixed(2)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={available <= 0}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm input-action"
                  style={{ width: 'auto', padding: '0 10px' }}
                  onClick={() => setAmount(available.toFixed(2))}
                  disabled={available <= 0}
                >
                  Max (Zero Out)
                </button>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="merchant-payout-notes">Payment method / Notes <span className="opt">(optional)</span></label>
              <textarea
                id="merchant-payout-notes"
                className="textarea"
                placeholder="e.g. Bank transfer to CIB account / Instapay: 010xxxxxxxx"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && <Banner tone="rose">{error}</Banner>}
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
              <label className="label" htmlFor="merchant-reject-reason">Reason <span className="opt">(optional)</span></label>
              <textarea
                id="merchant-reject-reason"
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
