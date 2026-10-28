import { useState } from 'react';
import { Package, PackagePlus } from 'lucide-react';
import { useAsync, useStatusCounts } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { Merchant, ParcelStatus } from '../../api/types';
import { ParcelTable } from '../../components/ParcelTable';
import { EmptyState, ErrorState, FilterChips, Loading, PageHeader, Pagination, Panel, RefreshButton, type ChipOption } from '../../components/ui';
import { PARCEL_STATUSES, STATUS_META } from '../../lib/status';
import type { MerchantTab } from './MerchantView';

const PAGE_SIZE = 15;
type Filter = ParcelStatus | 'ALL';

export function MerchantParcels({ merchant, onNavigate }: { merchant: Merchant; onNavigate: (t: MerchantTab) => void }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);

  const stats = useStatusCounts({ merchantId: merchant.id });
  // The API doesn't scope by role, so we must filter by merchantId explicitly.
  const list = useAsync(
    () => Api.parcels.list({ merchantId: merchant.id, status: filter === 'ALL' ? undefined : filter, page, pageSize: PAGE_SIZE }),
    [merchant.id, filter, page],
  );

  const options: ChipOption<Filter>[] = [
    { value: 'ALL', label: 'All', count: stats.data?.total },
    ...PARCEL_STATUSES.map((s) => ({ value: s as Filter, label: STATUS_META[s].label, count: stats.data?.counts[s] })),
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow={merchant.businessName}
        title="My parcels"
        subtitle="Every shipment you've booked through the Armant hub."
        actions={
          <>
            <RefreshButton onClick={() => { list.reload(); stats.reload(); }} loading={list.loading} />
            <button className="btn btn-primary" onClick={() => onNavigate('create')}><PackagePlus size={16} /> New parcel</button>
          </>
        }
      />
      <Panel
        title={<FilterChips idPrefix="merchant-filter" options={options} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} />}
        footer={list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} pageSize={list.data.pageSize} onChange={setPage} noun="parcels" />}
      >
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading label="Loading parcels…" />
        ) : list.data.parcels.length === 0 ? (
          <EmptyState
            icon={Package}
            title={filter === 'ALL' ? 'No parcels yet' : `No ${STATUS_META[filter].label.toLowerCase()} parcels`}
            action={filter === 'ALL' ? <button className="btn btn-primary" onClick={() => onNavigate('create')}><PackagePlus size={16} /> New parcel</button> : undefined}
          />
        ) : (
          <div style={{ opacity: list.loading ? 0.6 : 1, transition: 'opacity .2s' }}>
            <ParcelTable parcels={list.data.parcels} showCourier />
          </div>
        )}
      </Panel>
    </div>
  );
}
