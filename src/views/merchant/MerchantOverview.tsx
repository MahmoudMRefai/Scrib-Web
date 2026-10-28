import { ArrowRight, CheckCircle2, Clock, Package, PackagePlus, Truck } from 'lucide-react';
import { useAsync, useMyWallet, useStatusCounts } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { Merchant } from '../../api/types';
import { EmptyState, ErrorState, Loading, PageHeader, Panel, RefreshButton, StatCard, StatusPill } from '../../components/ui';
import { WalletHero } from '../../components/WalletHero';
import { count, money, timeAgo } from '../../lib/format';
import type { MerchantTab } from './MerchantView';

export function MerchantOverview({ merchant, onNavigate }: { merchant: Merchant; onNavigate: (t: MerchantTab) => void }) {
  const wallet = useMyWallet();
  const stats = useStatusCounts({ merchantId: merchant.id });
  const recent = useAsync(() => Api.parcels.list({ merchantId: merchant.id, pageSize: 6 }), [merchant.id]);

  const c = stats.data?.counts;
  const inTransit = c ? c.PICKED_UP + c.AT_HUB + c.OUT_FOR_DELIVERY : 0;
  const loadingStats = stats.loading && !stats.data;

  const refresh = () => {
    wallet.reload();
    stats.reload();
    recent.reload();
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
            <button id="new-parcel-btn" className="btn btn-primary" onClick={() => onNavigate('create')}>
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
        meta={[{ label: 'Flat delivery fee', value: money(merchant.flatDeliveryFee) }]}
      >
        <span className="hint">Credited with COD minus the delivery fee each time a parcel is delivered.</span>
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
            action={<button className="btn btn-primary" onClick={() => onNavigate('create')}><PackagePlus size={16} /> New parcel</button>}
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
    </div>
  );
}
