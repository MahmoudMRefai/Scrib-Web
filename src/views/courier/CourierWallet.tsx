import { useState, type FormEvent } from 'react';
import { HandCoins, Send } from 'lucide-react';
import { useAsync, useMyWallet } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import { useSession } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import { WalletHero } from '../../components/WalletHero';
import { Banner, EmptyState, ErrorState, Loading, PageHeader, Pagination, Panel, RefreshButton, SettlementPill, Spinner } from '../../components/ui';
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

  const wallet = useMyWallet();
  // Settlement.courierId is the courier's User id; the API doesn't scope by role.
  const history = useAsync(() => Api.settlements.list({ courierId: user.id, page, pageSize: PAGE_SIZE }), [user.id, page]);
  // All pending requests (not just this page) so we don't let the courier over-commit.
  const pending = useAsync(() => Api.settlements.list({ courierId: user.id, status: 'PENDING', pageSize: 100 }), [user.id]);

  const balance = toNumber(wallet.data?.balance);
  const pendingTotal = (pending.data?.settlements ?? []).reduce((s, x) => s + toNumber(x.amount), 0);
  const available = Math.max(0, balance - pendingTotal);
  const hasWallet = wallet.data !== null && wallet.data !== undefined;

  const refresh = () => {
    wallet.reload();
    history.reload();
    pending.reload();
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
          loading={wallet.loading}
          error={wallet.error}
          label="Cash on hand · owed to hub"
          meta={[
            { label: 'Awaiting confirmation', value: money(pendingTotal) },
            { label: 'Available to settle', value: money(available) },
          ]}
        />

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
    </div>
  );
}
