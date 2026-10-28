import { useState, type FormEvent } from 'react';
import { MapPin, Package, PackagePlus, Phone, Scale, StickyNote, User } from 'lucide-react';
import { useAsync, useStatusCounts } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { Merchant, ParcelStatus } from '../../api/types';
import { ParcelTable } from '../../components/ParcelTable';
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
import { PARCEL_STATUSES, STATUS_META } from '../../lib/status';
import { errorMessage, money, toNumber } from '../../lib/format';

const PAGE_SIZE = 15;
type Filter = ParcelStatus | 'ALL';

interface FormState {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: string;
  weight: string;
  notes: string;
}

const EMPTY: FormState = {
  recipientName: '',
  recipientPhone: '',
  recipientAddress: '',
  codAmount: '',
  weight: '',
  notes: '',
};

/** Client-side mirror of createParcelSchema in Scribe Core. */
function validate(f: FormState, minCod: number): Partial<Record<keyof FormState, string>> {
  const errs: Partial<Record<keyof FormState, string>> = {};
  if (!f.recipientName.trim()) errs.recipientName = 'Recipient name is required';
  if (f.recipientPhone.trim().length < 8) errs.recipientPhone = 'Enter a valid phone number';
  if (f.recipientAddress.trim().length < 5) errs.recipientAddress = 'Address must be at least 5 characters';
  if (f.codAmount.trim() === '' || !Number.isFinite(Number(f.codAmount)) || Number(f.codAmount) < minCod)
    errs.codAmount = `COD amount cannot be less than the delivery fee (${money(minCod)})`;
  if (f.weight.trim() !== '' && (!Number.isFinite(Number(f.weight)) || Number(f.weight) < 0))
    errs.weight = 'Weight must be 0 or more';
  return errs;
}

export function MerchantParcels({
  merchant,
  createOpen = false,
  onCreateOpenChange,
}: {
  merchant: Merchant;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [localCreateOpen, setLocalCreateOpen] = useState(false);

  const isCreateOpen = createOpen || localCreateOpen;
  const setModalOpen = (next: boolean) => {
    setLocalCreateOpen(next);
    onCreateOpenChange?.(next);
  };

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const cod = toNumber(form.codAmount);
  const fee = toNumber(merchant.flatDeliveryFee);
  const payout = cod - fee;

  const openCreateModal = () => {
    setErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const closeCreateModal = () => {
    if (busy) return;
    setModalOpen(false);
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const errs = validate(form, fee);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const parcel = await Api.parcels.create({
        merchantId: merchant.id,
        recipientName: form.recipientName.trim(),
        recipientPhone: form.recipientPhone.trim(),
        recipientAddress: form.recipientAddress.trim(),
        codAmount: Number(form.codAmount),
        weight: form.weight.trim() ? Number(form.weight) : undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success('Parcel created', `Tracking ID ${parcel.trackingId}`);
      setForm(EMPTY);
      setErrors({});
      setServerError(null);
      setModalOpen(false);
      list.reload();
      stats.reload();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors as Partial<Record<keyof FormState, string>>);
      }
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: set(key),
    className: `input ${errors[key] ? 'invalid' : ''}`,
    'aria-invalid': Boolean(errors[key]),
  });

  return (
    <div className="stack">
      <PageHeader
        eyebrow={merchant.businessName}
        title="Parcels"
        subtitle="Manage your shipments and book new cash-on-delivery parcels through the Armant hub."
        actions={
          <>
            <RefreshButton onClick={() => { list.reload(); stats.reload(); }} loading={list.loading} />
            <button id="new-parcel-btn" className="btn btn-primary" onClick={openCreateModal}>
              <PackagePlus size={16} /> New parcel
            </button>
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
            action={
              filter === 'ALL' ? (
                <button className="btn btn-primary" onClick={openCreateModal}>
                  <PackagePlus size={16} /> New parcel
                </button>
              ) : undefined
            }
          />
        ) : (
          <div style={{ opacity: list.loading ? 0.6 : 1, transition: 'opacity .2s' }}>
            <ParcelTable parcels={list.data.parcels} showCourier />
          </div>
        )}
      </Panel>

      {isCreateOpen && (
        <Modal
          open
          width={640}
          busy={busy}
          title="New parcel"
          subtitle="Book a cash-on-delivery shipment. The hub will assign a courier for pickup."
          onClose={closeCreateModal}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setForm(EMPTY);
                  setErrors({});
                  setServerError(null);
                }}
                disabled={busy}
              >
                Clear
              </button>
              <button type="button" className="btn btn-ghost" onClick={closeCreateModal} disabled={busy}>
                Cancel
              </button>
              <button id="create-parcel-submit" type="submit" form="create-parcel-form" className="btn btn-primary" disabled={busy}>
                {busy ? <Spinner size={14} /> : <PackagePlus size={16} />} Create parcel
              </button>
            </>
          }
        >
          <form id="create-parcel-form" className="stack-sm" onSubmit={submitCreate} noValidate>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="recipientName">Recipient name</label>
                <div className="input-wrap">
                  <span className="input-icon"><User size={16} /></span>
                  <input id="recipientName" placeholder="e.g. Youssef Kamal" autoComplete="off" autoFocus {...field('recipientName')} />
                </div>
                {errors.recipientName && <span className="field-error">{errors.recipientName}</span>}
              </div>

              <div className="field">
                <label className="label" htmlFor="recipientPhone">Recipient phone</label>
                <div className="input-wrap">
                  <span className="input-icon"><Phone size={16} /></span>
                  <input id="recipientPhone" type="tel" placeholder="010 1234 5678" autoComplete="off" {...field('recipientPhone')} />
                </div>
                {errors.recipientPhone && <span className="field-error">{errors.recipientPhone}</span>}
              </div>

              <div className="field span-2">
                <label className="label" htmlFor="recipientAddress">Delivery address</label>
                <div className="input-wrap">
                  <span className="input-icon"><MapPin size={16} /></span>
                  <input id="recipientAddress" placeholder="Street, district, village" autoComplete="off" {...field('recipientAddress')} />
                </div>
                {errors.recipientAddress && <span className="field-error">{errors.recipientAddress}</span>}
              </div>

              <div className="field">
                <label className="label" htmlFor="codAmount">Cash on delivery</label>
                <div className="input-wrap has-prefix">
                  <span className="input-prefix">EGP</span>
                  <input id="codAmount" type="number" inputMode="decimal" min={fee} step="0.01" placeholder={fee.toFixed(2)} {...field('codAmount')} />
                </div>
                {errors.codAmount ? (
                  <span className="field-error">{errors.codAmount}</span>
                ) : (
                  <span className="hint">Minimum {money(fee)} (delivery fee). Collected by the courier at the door.</span>
                )}
              </div>

              <div className="field">
                <label className="label" htmlFor="weight">Weight <span className="opt">(optional, kg)</span></label>
                <div className="input-wrap">
                  <span className="input-icon"><Scale size={16} /></span>
                  <input id="weight" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.5" {...field('weight')} />
                </div>
                {errors.weight && <span className="field-error">{errors.weight}</span>}
              </div>

              <div className="field span-2">
                <label className="label" htmlFor="notes">Notes <span className="opt">(optional)</span></label>
                <div className="input-wrap">
                  <span className="input-icon" style={{ top: 22 }}><StickyNote size={16} /></span>
                  <textarea id="notes" className="textarea" style={{ paddingLeft: 42 }} placeholder="Fragile, call before arrival, gift wrapped…" value={form.notes} onChange={set('notes')} />
                </div>
              </div>
            </div>

            <div className="summary">
              <div className="summary-row"><span>COD collected</span><span>{money(cod)}</span></div>
              <div className="summary-row"><span>Flat delivery fee</span><span>− {money(fee)}</span></div>
              <div className="summary-row total">
                <span>You receive</span>
                <span style={{ color: payout < 0 ? 'var(--rose)' : 'var(--green)' }}>{money(payout)}</span>
              </div>
            </div>

            {payout < 0 && form.codAmount !== '' && (
              <Banner tone="rose" title="COD below delivery fee">Parcel COD amount cannot be less than your flat delivery fee ({money(fee)}).</Banner>
            )}

            {serverError && <Banner tone="rose" title="Couldn't create parcel">{serverError}</Banner>}
          </form>
        </Modal>
      )}
    </div>
  );
}
