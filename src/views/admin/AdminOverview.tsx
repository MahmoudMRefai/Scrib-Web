import { ArrowRight, Banknote, CheckCircle2, Clock, HandCoins, Landmark, Package, TriangleAlert, Truck } from 'lucide-react';
import { useAsync, useStatusCounts } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import { EmptyState, ErrorState, Loading, PageHeader, Panel, RefreshButton, SettlementPill, StatCard, StatusPill } from '../../components/ui';
import { PARCEL_STATUSES, STATUS_META } from '../../lib/status';
import { count, money, timeAgo, toNumber } from '../../lib/format';
import type { AdminTab } from './AdminView';

export function AdminOverview({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const stats = useStatusCounts({});
  const wallets = useAsync(() => Api.wallets.list(), []);
  const pendingSettlements = useAsync(() => Api.settlements.list({ status: 'PENDING', pageSize: 5 }), []);
  const recent = useAsync(() => Api.parcels.list({ pageSize: 6 }), []);

  const c = stats.data?.counts;
  const inTransit = c ? c.PICKED_UP + c.AT_HUB + c.OUT_FOR_DELIVERY : 0;
  const exceptions = c ? c.FAILED + c.RETURNED_TO_ORIGIN : 0;

  const courierCash = (wallets.data ?? [])
    .filter((w) => w.ownerType === 'COURIER')
    .reduce((sum, w) => sum + toNumber(w.balance), 0);
  const hubCash = (wallets.data ?? [])
    .filter((w) => w.ownerType === 'SYSTEM' && w.type === 'ASSET')
    .reduce((sum, w) => sum + toNumber(w.balance), 0);
  const merchantOwed = (wallets.data ?? [])
    .filter((w) => w.ownerType === 'MERCHANT')
    .reduce((sum, w) => sum + toNumber(w.balance), 0);

  const refreshAll = () => {
    stats.reload();
    wallets.reload();
    pendingSettlements.reload();
    recent.reload();
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Armant hub"
        title="Operations overview"
        subtitle="Live parcel pipeline and cash position across couriers, merchants and the hub."
        actions={<RefreshButton onClick={refreshAll} loading={stats.loading || wallets.loading} />}
      />

      {stats.error && <Panel><ErrorState message={stats.error} onRetry={stats.reload} /></Panel>}

      <div className="stats">
        <StatCard label="Total parcels" value={count(stats.data?.total ?? 0)} icon={Package} tone="violet" loading={stats.loading && !stats.data} hint="All time" />
        <StatCard label="Awaiting courier" value={count(c?.PENDING ?? 0)} icon={Clock} tone="slate" loading={stats.loading && !stats.data} hint="Pending assignment" />
        <StatCard label="In transit" value={count(inTransit)} icon={Truck} tone="gold" loading={stats.loading && !stats.data} hint="Picked up · at hub · out for delivery" />
        <StatCard label="Delivered" value={count(c?.DELIVERED ?? 0)} icon={CheckCircle2} tone="green" loading={stats.loading && !stats.data} hint={`${count(exceptions)} failed or returned`} />
      </div>

      <div className="stats">
        <StatCard label="Cash with couriers" value={money(courierCash)} icon={Banknote} tone="teal" loading={wallets.loading && !wallets.data} hint="COD collected, not yet settled" />
        <StatCard label="Cash at hub" value={money(hubCash)} icon={Landmark} tone="sky" loading={wallets.loading && !wallets.data} hint="Confirmed settlements" />
        <StatCard label="Owed to merchants" value={money(merchantOwed)} icon={HandCoins} tone="violet" loading={wallets.loading && !wallets.data} hint="Net of delivery fees" />
        <StatCard
          label="Pending settlements"
          value={count(pendingSettlements.data?.total ?? 0)}
          icon={TriangleAlert}
          tone="gold"
          loading={pendingSettlements.loading && !pendingSettlements.data}
          hint="Awaiting cash confirmation"
        />
      </div>

      <Panel title="Parcel pipeline" subtitle="Distribution of all parcels by status">
        <div className="panel-body">
          {stats.data && stats.data.total > 0 ? (
            <>
              <div className="pipeline">
                {PARCEL_STATUSES.filter((s) => c![s] > 0).map((s) => (
                  <span key={s} className={`tone-${STATUS_META[s].tone}`} style={{ flexGrow: c![s] }} title={`${STATUS_META[s].label}: ${c![s]}`} />
                ))}
              </div>
              <div className="legend">
                {PARCEL_STATUSES.map((s) => (
                  <div key={s} className={`legend-item tone-${STATUS_META[s].tone}`}>
                    <span className="pill-dot" />
                    {STATUS_META[s].label}
                    <b>{count(c![s])}</b>
                  </div>
                ))}
              </div>
            </>
          ) : stats.loading ? (
            <Loading />
          ) : (
            <EmptyState icon={Package} title="No parcels yet" message="Parcels created by merchants will show up here." />
          )}
        </div>
      </Panel>

      <div className="grid-2">
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
            <EmptyState title="No parcels yet" />
          ) : (
            <div className="list">
              {recent.data.parcels.map((p) => (
                <div key={p.id} className="list-item">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mono cell-main">{p.trackingId}</div>
                    <div className="cell-sub">
                      {p.merchant?.businessName ?? '—'} → {p.recipientName} · {timeAgo(p.createdAt)}
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
          title="Settlements awaiting cash"
          actions={
            <button className="btn btn-sm btn-ghost" onClick={() => onNavigate('settlements')}>
              Review <ArrowRight size={14} />
            </button>
          }
        >
          {pendingSettlements.error ? (
            <ErrorState message={pendingSettlements.error} onRetry={pendingSettlements.reload} />
          ) : !pendingSettlements.data ? (
            <Loading />
          ) : pendingSettlements.data.settlements.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All settled" message="No couriers are waiting on a cash handover." />
          ) : (
            <div className="list">
              {pendingSettlements.data.settlements.map((s) => (
                <div key={s.id} className="list-item">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="cell-main">{s.courier?.name ?? 'Courier'}</div>
                    <div className="cell-sub">Requested {timeAgo(s.createdAt)}</div>
                  </div>
                  <div className="num nowrap cell-main">{money(s.amount)}</div>
                  <SettlementPill status={s.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
