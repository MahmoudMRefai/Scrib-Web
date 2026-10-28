import { useState } from 'react';
import { Bike } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import { EmptyState, ErrorState, Loading, PageHeader, Pagination, Panel, Pill, RefreshButton } from '../../components/ui';
import { date, initials, titleCase } from '../../lib/format';

const PAGE_SIZE = 20;

export function AdminCouriers() {
  const [page, setPage] = useState(1);
  const list = useAsync(() => Api.couriers.list(page, PAGE_SIZE), [page]);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Fleet"
        title="Couriers"
        subtitle={list.data ? `${list.data.total} registered couriers` : 'Registered couriers'}
        actions={<RefreshButton onClick={list.reload} loading={list.loading} />}
      />
      <Panel
        footer={list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} pageSize={list.data.pageSize} onChange={setPage} noun="couriers" />}
      >
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading label="Loading couriers…" />
        ) : list.data.couriers.length === 0 ? (
          <EmptyState icon={Bike} title="No couriers yet" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Courier</th>
                  <th>Phone</th>
                  <th>Vehicle</th>
                  <th>Base</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {list.data.couriers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="row">
                        <div className="avatar avatar-sm tone-teal">{initials(c.user.name)}</div>
                        <div>
                          <div className="cell-main">{c.user.name}</div>
                          <div className="cell-sub">{c.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="nowrap muted">{c.phone ?? '—'}</td>
                    <td>{c.vehicleType ? <span className="tag">{titleCase(c.vehicleType)}</span> : <span className="faint">—</span>}</td>
                    <td className="muted">{c.currentLocation ?? c.address ?? '—'}</td>
                    <td>{c.isActive ? <Pill tone="green">Active</Pill> : <Pill tone="slate">Inactive</Pill>}</td>
                    <td className="nowrap muted">{date(c.createdAt)}</td>
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
