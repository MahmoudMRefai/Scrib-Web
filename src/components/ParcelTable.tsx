import type { ReactNode } from 'react';
import type { Parcel } from '../api/types';
import { StatusPill } from './ui';
import { date, money } from '../lib/format';

export function ParcelTable({
  parcels,
  showMerchant = false,
  showCourier = false,
  actions,
}: {
  parcels: Parcel[];
  showMerchant?: boolean;
  showCourier?: boolean;
  actions?: (p: Parcel) => ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Tracking</th>
            <th>Recipient</th>
            <th>Address</th>
            {showMerchant && <th>Merchant</th>}
            {showCourier && <th>Courier</th>}
            <th className="num">COD</th>
            <th>Status</th>
            {actions && <th className="num">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {parcels.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="mono cell-main">{p.trackingId}</div>
                <div className="cell-sub">{date(p.createdAt)}</div>
              </td>
              <td>
                <div className="cell-main">{p.recipientName}</div>
                <div className="cell-sub">{p.recipientPhone}</div>
              </td>
              <td>
                <div className="truncate muted" title={p.recipientAddress}>
                  {p.recipientAddress}
                </div>
                {p.notes && (
                  <div className="cell-sub truncate" title={p.notes}>
                    {p.notes}
                  </div>
                )}
              </td>
              {showMerchant && <td className="nowrap">{p.merchant?.businessName ?? '—'}</td>}
              {showCourier && (
                <td className="nowrap">{p.courier?.name ?? <span className="faint">Unassigned</span>}</td>
              )}
              <td className="num nowrap cell-main">{money(p.codAmount)}</td>
              <td>
                <StatusPill status={p.status} />
              </td>
              {actions && (
                <td>
                  <div className="cell-actions">{actions(p)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
