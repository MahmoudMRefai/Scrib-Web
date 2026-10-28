import { useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { AccountOwnerType } from '../../api/types';
import { EmptyState, ErrorState, FilterChips, Loading, PageHeader, Panel, RefreshButton } from '../../components/ui';
import { dateTime, initials, money, titleCase, toNumber } from '../../lib/format';
import type { Tone } from '../../lib/status';

type Filter = AccountOwnerType | 'ALL';
const OWNER_TONE: Record<AccountOwnerType, Tone> = { COURIER: 'teal', MERCHANT: 'violet', SYSTEM: 'gold' };

export function AdminWallets() {
  const [filter, setFilter] = useState<Filter>('ALL');
  // GET /wallets returns a plain array (no pagination), so filter client-side.
  const list = useAsync(() => Api.wallets.list(), []);

  const all = list.data ?? [];
  const rows = useMemo(
    () =>
      all
        .filter((w) => filter === 'ALL' || w.ownerType === filter)
        .sort((a, b) => toNumber(b.balance) - toNumber(a.balance)),
    [all, filter],
  );
  const total = rows.reduce((s, w) => s + toNumber(w.balance), 0);
  const countOf = (t: AccountOwnerType) => all.filter((w) => w.ownerType === t).length;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Ledger"
        title="Wallets"
        subtitle="Running balances of every ledger account. Courier balances are cash in hand owed to the hub; merchant balances are payouts owed."
        actions={<RefreshButton onClick={list.reload} loading={list.loading} />}
      />
      <Panel
        title={
          <FilterChips
            idPrefix="wallet-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'All', count: all.length },
              { value: 'COURIER', label: 'Couriers', count: countOf('COURIER') },
              { value: 'MERCHANT', label: 'Merchants', count: countOf('MERCHANT') },
              { value: 'SYSTEM', label: 'System', count: countOf('SYSTEM') },
            ]}
          />
        }
      >
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading label="Loading wallets…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Wallet} title="No wallets" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Owner</th>
                  <th>Type</th>
                  <th>Last movement</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <div className="row">
                        <div className={`avatar avatar-sm tone-${OWNER_TONE[w.ownerType]}`}>{initials(w.owner?.name ?? w.name)}</div>
                        <div className="cell-main">{w.name}</div>
                      </div>
                    </td>
                    <td>
                      <div>{w.owner?.name ?? '—'}</div>
                      <div className="cell-sub">{w.owner?.email}</div>
                    </td>
                    <td>
                      <span className="tag">{titleCase(w.ownerType)}</span>{' '}
                      <span className="tag">{titleCase(w.type)}</span>
                    </td>
                    <td className="nowrap muted">{dateTime(w.updatedAt)}</td>
                    <td className="num nowrap cell-main">{money(w.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="muted">Total ({rows.length} accounts)</td>
                  <td className="num nowrap">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
