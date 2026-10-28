import { useMemo, useState } from 'react';
import { ArrowRightLeft, Bike, Package, Search, UserPlus } from 'lucide-react';
import { useAsync, useStatusCounts } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { Courier, Parcel, ParcelStatus } from '../../api/types';
import { ParcelTable } from '../../components/ParcelTable';
import { StatusDialog } from '../../components/StatusDialog';
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
  RefreshButton,
  Spinner,
  type ChipOption,
} from '../../components/ui';
import { PARCEL_STATUSES, STATUS_META, isTerminal } from '../../lib/status';
import { errorMessage, initials, money, titleCase } from '../../lib/format';

const PAGE_SIZE = 15;
type Filter = ParcelStatus | 'ALL';

export function AdminParcels() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [assigning, setAssigning] = useState<Parcel | null>(null);
  const [updating, setUpdating] = useState<Parcel | null>(null);

  const stats = useStatusCounts({});
  const list = useAsync(
    () => Api.parcels.list({ status: filter === 'ALL' ? undefined : filter, page, pageSize: PAGE_SIZE }),
    [filter, page],
  );

  const chipOptions: ChipOption<Filter>[] = [
    { value: 'ALL', label: 'All', count: stats.data?.total },
    ...PARCEL_STATUSES.map((s) => ({ value: s as Filter, label: STATUS_META[s].label, count: stats.data?.counts[s] })),
  ];

  const refresh = () => {
    list.reload();
    stats.reload();
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Dispatch"
        title="Parcels"
        subtitle="Assign pending parcels to couriers and move parcels through the delivery pipeline."
        actions={<RefreshButton onClick={refresh} loading={list.loading} />}
      />

      <Panel
        title={
          <FilterChips
            idPrefix="parcel-filter"
            options={chipOptions}
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
          />
        }
        footer={
          list.data && (
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              total={list.data.total}
              pageSize={list.data.pageSize}
              onChange={setPage}
              noun="parcels"
            />
          )
        }
      >
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading label="Loading parcels…" />
        ) : list.data.parcels.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No parcels here"
            message={filter === 'ALL' ? 'No parcels have been created yet.' : `No parcels are currently ${STATUS_META[filter].label.toLowerCase()}.`}
          />
        ) : (
          <div style={{ opacity: list.loading ? 0.6 : 1, transition: 'opacity .2s' }}>
            <ParcelTable
              parcels={list.data.parcels}
              showMerchant
              showCourier
              actions={(p) =>
                p.status === 'PENDING' ? (
                  <button id={`assign-${p.trackingId}`} className="btn btn-primary btn-sm" onClick={() => setAssigning(p)}>
                    <UserPlus size={14} /> Assign
                  </button>
                ) : isTerminal(p.status) ? (
                  <span className="faint" style={{ fontSize: '0.8125rem' }}>Closed</span>
                ) : (
                  <button id={`update-${p.trackingId}`} className="btn btn-sm" onClick={() => setUpdating(p)}>
                    <ArrowRightLeft size={14} /> Update
                  </button>
                )
              }
            />
          </div>
        )}
      </Panel>

      <AssignCourierDialog parcel={assigning} onClose={() => setAssigning(null)} onDone={refresh} />
      <StatusDialog parcel={updating} onClose={() => setUpdating(null)} onDone={refresh} />
    </div>
  );
}

function AssignCourierDialog({ parcel, onClose, onDone }: { parcel: Parcel | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [selected, setSelected] = useState<Courier | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const open = parcel !== null;

  // The API caps pageSize at 100 — plenty for one hub's courier roster.
  const couriers = useAsync(async () => (open ? Api.couriers.list(1, 100) : null), [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (couriers.data?.couriers ?? [])
      .filter((c) => c.isActive)
      .filter((c) => !q || c.user.name.toLowerCase().includes(q) || c.user.email.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [couriers.data, query]);

  const close = () => {
    setSelected(null);
    setQuery('');
    onClose();
  };

  const submit = async () => {
    if (!parcel || !selected) return;
    setBusy(true);
    try {
      // The backend expects the courier's *User* id here, not the Courier row id.
      await Api.parcels.assign(parcel.id, selected.userId);
      toast.success(`Assigned to ${selected.user.name}`, `${parcel.trackingId} is now picked up.`);
      onDone();
      close();
    } catch (e) {
      toast.error('Assignment failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      busy={busy}
      onClose={close}
      title="Assign courier"
      subtitle={
        parcel && (
          <>
            <span className="mono">{parcel.trackingId}</span> · {parcel.recipientName} · {money(parcel.codAmount)} COD
          </>
        )
      }
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button id="confirm-assign-btn" className="btn btn-primary" onClick={submit} disabled={!selected || busy}>
            {busy ? <Spinner size={14} /> : <UserPlus size={16} />}
            {selected ? `Assign ${selected.user.name.split(' ')[0]}` : 'Select a courier'}
          </button>
        </>
      }
    >
      <div className="input-wrap">
        <span className="input-icon">
          <Search size={16} />
        </span>
        <input id="courier-search" className="input" placeholder="Search by name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {couriers.error ? (
        <Banner tone="rose" title="Couldn't load couriers">{couriers.error}</Banner>
      ) : !couriers.data ? (
        <Loading label="Loading couriers…" />
      ) : visible.length === 0 ? (
        <EmptyState icon={Bike} title="No active couriers" message={query ? 'Try a different search.' : 'Register a courier to start dispatching.'} />
      ) : (
        <div className="option-list">
          {visible.map((c) => (
            <button key={c.id} className={`option ${selected?.id === c.id ? 'selected' : ''}`} onClick={() => setSelected(c)}>
              <div className="avatar avatar-sm tone-teal">{initials(c.user.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="cell-main">{c.user.name}</div>
                <div className="cell-sub">
                  {c.user.email}
                  {c.phone ? ` · ${c.phone}` : ''}
                </div>
              </div>
              {c.vehicleType && <span className="tag" style={{ marginLeft: 'auto' }}>{titleCase(c.vehicleType)}</span>}
              <span className="option-radio" style={c.vehicleType ? { marginLeft: 8 } : undefined} />
            </button>
          ))}
        </div>
      )}

      <p className="hint" style={{ margin: 0 }}>
        Assigning moves the parcel from <b>Pending</b> to <b>Picked up</b>.
      </p>
    </Modal>
  );
}
