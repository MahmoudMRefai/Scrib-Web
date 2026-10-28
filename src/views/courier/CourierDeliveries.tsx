import { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Coins, MapPin, Phone, Route, Store, StickyNote, Truck } from 'lucide-react';
import { useAsync, useCourierWallet, useMyWallet, useStatusCounts } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import type { Parcel, ParcelStatus } from '../../api/types';
import { useSession } from '../../auth/AuthContext';
import { StatusDialog } from '../../components/StatusDialog';
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
  StatCard,
  StatusPill,
  type ChipOption,
} from '../../components/ui';
import { NEEDS_CONFIRMATION, NEXT_STATUS, STATUS_META, actionLabel, actionTone, isTerminal, progressOf } from '../../lib/status';
import { count, errorMessage, money, timeAgo } from '../../lib/format';
import type { CourierTab } from './CourierView';

type Filter = 'ACTIVE' | ParcelStatus;
const PAGE_SIZE = 12;
/** "Active" is computed client-side from one large page (the API filters a single status only). */
const ACTIVE_FETCH = 100;
const FILTER_STATUSES: ParcelStatus[] = ['PICKED_UP', 'AT_HUB', 'OUT_FOR_DELIVERY', 'FAILED', 'DELIVERED', 'RETURNED_TO_ORIGIN'];

export function CourierDeliveries({ onNavigate }: { onNavigate: (t: CourierTab) => void }) {
  const { user } = useSession();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ parcel: Parcel; target: ParcelStatus } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Parcel.courierId is the courier's User id — and the API doesn't scope by role, so filter explicitly.
  const scope = { courierId: user.id };
  const stats = useStatusCounts(scope);
  const wallet = useMyWallet();
  const courierWallet = useCourierWallet();
  const list = useAsync(
    () =>
      filter === 'ACTIVE'
        ? Api.parcels.list({ ...scope, page: 1, pageSize: ACTIVE_FETCH })
        : Api.parcels.list({ ...scope, status: filter, page, pageSize: PAGE_SIZE }),
    [user.id, filter, page],
  );

  const parcels = useMemo(() => {
    const all = list.data?.parcels ?? [];
    if (filter !== 'ACTIVE') return all;
    // Out-for-delivery first, then whatever needs the courier's attention next.
    const order: Record<ParcelStatus, number> = { OUT_FOR_DELIVERY: 0, FAILED: 1, AT_HUB: 2, PICKED_UP: 3, PENDING: 4, DELIVERED: 9, RETURNED_TO_ORIGIN: 9 };
    return all.filter((p) => !isTerminal(p.status)).sort((a, b) => order[a.status] - order[b.status]);
  }, [list.data, filter]);

  const c = stats.data?.counts;
  const activeCount = c ? c.PICKED_UP + c.AT_HUB + c.OUT_FOR_DELIVERY + c.FAILED : undefined;
  const loadingStats = stats.loading && !stats.data;

  const options: ChipOption<Filter>[] = [
    { value: 'ACTIVE', label: 'Active', count: activeCount },
    ...FILTER_STATUSES.map((s) => ({ value: s as Filter, label: STATUS_META[s].label, count: c?.[s] })),
  ];

  const refresh = () => {
    list.reload();
    stats.reload();
    wallet.reload();
    courierWallet.reload();
  };

  const advance = async (parcel: Parcel, target: ParcelStatus) => {
    if (NEEDS_CONFIRMATION.includes(target)) {
      setConfirm({ parcel, target });
      return;
    }
    setBusyId(parcel.id);
    try {
      await Api.parcels.updateStatus(parcel.id, target);
      toast.success(`${parcel.trackingId} → ${STATUS_META[target].label}`);
      refresh();
    } catch (e) {
      toast.error('Status update failed', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`Good ${greeting()}, ${user.name.split(' ')[0]}`}
        title="My deliveries"
        subtitle="Move each assigned parcel to its next step. Cash you collect is added to your wallet."
        actions={<RefreshButton onClick={refresh} loading={list.loading} />}
      />

      <div className="stats">
        <StatCard
          label="Commission owed to you"
          value={courierWallet.data ? money(courierWallet.data.pendingPayout) : '—'}
          icon={Coins}
          tone="green"
          loading={courierWallet.loading && courierWallet.data === undefined}
          hint={courierWallet.data ? `Total earned: ${money(courierWallet.data.totalEarnings)}` : undefined}
        />
        <StatCard
          label="Cash on hand"
          value={
            courierWallet.data?.cashInHand !== undefined
              ? money(courierWallet.data.cashInHand)
              : wallet.data === null
              ? '—'
              : money(wallet.data?.balance)
          }
          icon={Banknote}
          tone="teal"
          loading={wallet.loading && wallet.data === undefined && courierWallet.data === undefined}
          hint={
            <button className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', color: 'var(--teal)' }} onClick={() => onNavigate('wallet')}>
              Settle with hub →
            </button>
          }
        />
        <StatCard label="Out for delivery" value={count(c?.OUT_FOR_DELIVERY ?? 0)} icon={Truck} tone="gold" loading={loadingStats} />
        <StatCard label="Delivered" value={count(c?.DELIVERED ?? 0)} icon={CheckCircle2} tone="green" loading={loadingStats} hint={c ? `${count(c.FAILED)} need a retry` : undefined} />
      </div>

      <FilterChips idPrefix="courier-filter" options={options} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} />

      {list.error ? (
        <Panel><ErrorState message={list.error} onRetry={list.reload} /></Panel>
      ) : !list.data ? (
        <Loading label="Loading your parcels…" />
      ) : parcels.length === 0 ? (
        <Panel>
          <EmptyState
            icon={filter === 'ACTIVE' ? CheckCircle2 : Route}
            title={filter === 'ACTIVE' ? 'You’re all caught up' : `No ${STATUS_META[filter].label.toLowerCase()} parcels`}
            message={filter === 'ACTIVE' ? 'New parcels appear here as soon as the hub assigns them to you.' : undefined}
          />
        </Panel>
      ) : (
        <>
          {filter === 'ACTIVE' && list.data.total > ACTIVE_FETCH && (
            <Banner tone="gold" title="Showing your latest 100 parcels">Use the status filters to see older assignments.</Banner>
          )}
          <div className="parcel-grid" style={{ opacity: list.loading ? 0.6 : 1, transition: 'opacity .2s' }}>
            {parcels.map((p) => (
              <ParcelCard key={p.id} parcel={p} busy={busyId === p.id} onAdvance={(t) => advance(p, t)} />
            ))}
          </div>
          {filter !== 'ACTIVE' && (
            <Panel>
              <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} pageSize={list.data.pageSize} onChange={setPage} noun="parcels" />
            </Panel>
          )}
        </>
      )}

      <StatusDialog parcel={confirm?.parcel ?? null} target={confirm?.target} onClose={() => setConfirm(null)} onDone={refresh} />
    </div>
  );
}

function ParcelCard({ parcel, busy, onAdvance }: { parcel: Parcel; busy: boolean; onAdvance: (target: ParcelStatus) => void }) {
  const next = NEXT_STATUS[parcel.status];
  const { step, failed } = progressOf(parcel.status);

  return (
    <article className="card parcel-card">
      <div className="parcel-top">
        <div>
          <div className="mono cell-main">{parcel.trackingId}</div>
          <div className="cell-sub">Assigned {timeAgo(parcel.updatedAt)}</div>
        </div>
        <StatusPill status={parcel.status} />
      </div>

      <div className="steps" aria-label={`Progress: ${STATUS_META[parcel.status].label}`}>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`step ${i <= step ? (failed && i === 4 ? 'fail' : 'done') : ''}`} />
        ))}
      </div>

      <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div>
          <div className="cell-sub">Collect on delivery</div>
          <div className="cod">{money(parcel.codAmount)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="cell-sub">Your commission</div>
          <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.95rem' }}>
            {parcel.courierCommission ? `+${money(parcel.courierCommission)}` : '—'}
          </div>
        </div>
      </div>

      {parcel.merchant && (
        <div style={{ marginTop: '2px' }}>
          <span className="tag" title="Merchant"><Store size={11} style={{ marginRight: 4 }} />{parcel.merchant.businessName}</span>
        </div>
      )}

      <div className="kv">
        <div className="kv-row">
          <Phone size={15} />
          <span>
            <b style={{ color: 'var(--text)', fontWeight: 500 }}>{parcel.recipientName}</b> ·{' '}
            <a href={`tel:${parcel.recipientPhone.replace(/[^\d+]/g, '')}`}>{parcel.recipientPhone}</a>
          </span>
        </div>
        <div className="kv-row">
          <MapPin size={15} />
          <span>{parcel.recipientAddress}</span>
        </div>
        {parcel.notes && (
          <div className="kv-row">
            <StickyNote size={15} />
            <span>{parcel.notes}</span>
          </div>
        )}
      </div>

      {next.length > 0 && (
        <div className="parcel-actions">
          {next.map((target) => {
            const primary = target === 'DELIVERED' || (next.length === 1 && target !== 'RETURNED_TO_ORIGIN');
            return (
              <button
                key={target}
                id={`advance-${parcel.trackingId}-${target.toLowerCase()}`}
                className={primary ? 'btn btn-primary btn-sm' : `btn btn-sm btn-tone tone-${actionTone(target)}`}
                disabled={busy}
                onClick={() => onAdvance(target)}
              >
                {busy && <Spinner size={13} />}
                {actionLabel(parcel.status, target)}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
