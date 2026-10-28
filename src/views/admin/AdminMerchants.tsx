import { useState } from 'react';
import { Store } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import { EmptyState, ErrorState, Loading, PageHeader, Pagination, Panel, Pill, RefreshButton } from '../../components/ui';
import { date, initials, money } from '../../lib/format';

const PAGE_SIZE = 20;

export function AdminMerchants() {
  const [page, setPage] = useState(1);
  const list = useAsync(() => Api.merchants.list(page, PAGE_SIZE), [page]);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Partners"
        title="Merchants"
        subtitle={list.data ? `${list.data.total} merchants shipping through Armant` : 'Merchants shipping through Armant'}
        actions={<RefreshButton onClick={list.reload} loading={list.loading} />}
      />
      <Panel
        footer={list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} pageSize={list.data.pageSize} onChange={setPage} noun="merchants" />}
      >
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading label="Loading merchants…" />
        ) : list.data.merchants.length === 0 ? (
          <EmptyState icon={Store} title="No merchants yet" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th className="num">Delivery fee</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {list.data.merchants.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="row">
                        <div className="avatar avatar-sm tone-violet">{initials(m.businessName)}</div>
                        <div className="cell-main">{m.businessName}</div>
                      </div>
                    </td>
                    <td>
                      <div>{m.user?.name ?? '—'}</div>
                      <div className="cell-sub">{m.user?.email}</div>
                    </td>
                    <td className="nowrap muted">{m.phone ?? '—'}</td>
                    <td><div className="truncate muted" title={m.address ?? ''}>{m.address ?? '—'}</div></td>
                    <td className="num nowrap">{money(m.flatDeliveryFee)}</td>
                    <td>{m.isActive ? <Pill tone="green">Active</Pill> : <Pill tone="slate">Inactive</Pill>}</td>
                    <td className="nowrap muted">{date(m.createdAt)}</td>
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
