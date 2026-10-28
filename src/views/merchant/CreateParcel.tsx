import { useState, type FormEvent } from 'react';
import { MapPin, PackagePlus, Phone, Scale, StickyNote, User } from 'lucide-react';
import { Api } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { Merchant } from '../../api/types';
import { useToast } from '../../components/Toast';
import { Banner, PageHeader, Panel, Spinner } from '../../components/ui';
import { errorMessage, money, toNumber } from '../../lib/format';

interface FormState {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: string;
  weight: string;
  notes: string;
}

const EMPTY: FormState = { recipientName: '', recipientPhone: '', recipientAddress: '', codAmount: '', weight: '', notes: '' };

/** Client-side mirror of createParcelSchema in Scribe Core. */
function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errs: Partial<Record<keyof FormState, string>> = {};
  if (!f.recipientName.trim()) errs.recipientName = 'Recipient name is required';
  if (f.recipientPhone.trim().length < 8) errs.recipientPhone = 'Enter a valid phone number';
  if (f.recipientAddress.trim().length < 5) errs.recipientAddress = 'Address must be at least 5 characters';
  if (f.codAmount.trim() === '' || !Number.isFinite(Number(f.codAmount)) || Number(f.codAmount) < 0)
    errs.codAmount = 'Enter a COD amount of 0 or more';
  if (f.weight.trim() !== '' && (!Number.isFinite(Number(f.weight)) || Number(f.weight) < 0))
    errs.weight = 'Weight must be 0 or more';
  return errs;
}

export function CreateParcel({ merchant, onCreated }: { merchant: Merchant; onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const cod = toNumber(form.codAmount);
  const fee = toNumber(merchant.flatDeliveryFee);
  const payout = cod - fee;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const errs = validate(form);
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
      onCreated();
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
      <PageHeader eyebrow={merchant.businessName} title="New parcel" subtitle="Book a cash-on-delivery shipment. The hub will assign a courier for pickup." />

      <div className="grid-main">
        <Panel title="Recipient & shipment">
          <form className="panel-body" onSubmit={submit} noValidate>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="recipientName">Recipient name</label>
                <div className="input-wrap">
                  <span className="input-icon"><User size={16} /></span>
                  <input id="recipientName" placeholder="e.g. Youssef Kamal" autoComplete="off" {...field('recipientName')} />
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
                  <input id="codAmount" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" {...field('codAmount')} />
                </div>
                {errors.codAmount ? <span className="field-error">{errors.codAmount}</span> : <span className="hint">Collected by the courier at the door.</span>}
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

            {serverError && <div style={{ marginTop: 16 }}><Banner tone="rose" title="Couldn't create parcel">{serverError}</Banner></div>}

            <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setForm(EMPTY); setErrors({}); setServerError(null); }} disabled={busy}>
                Clear
              </button>
              <button id="create-parcel-submit" type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <Spinner size={14} /> : <PackagePlus size={16} />} Create parcel
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Payout estimate" subtitle="Booked to your wallet on delivery">
          <div className="panel-body stack-sm">
            <div className="summary">
              <div className="summary-row"><span>COD collected</span><span>{money(cod)}</span></div>
              <div className="summary-row"><span>Flat delivery fee</span><span>− {money(fee)}</span></div>
              <div className="summary-row total">
                <span>You receive</span>
                <span style={{ color: payout < 0 ? 'var(--rose)' : 'var(--green)' }}>{money(payout)}</span>
              </div>
            </div>
            {payout < 0 && form.codAmount !== '' && (
              <Banner tone="gold" title="COD below delivery fee">The fee exceeds the COD, so this parcel will reduce your balance.</Banner>
            )}
            <p className="hint" style={{ margin: 0 }}>
              Parcels start as <b>Pending</b>. Once the hub assigns a courier you can follow progress in <b>My parcels</b>.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
