import type { ReactNode } from 'react';
import { Wallet, WalletCards } from 'lucide-react';
import type { LedgerAccount } from '../api/types';
import { Banner, Skeleton } from './ui';
import { dateTime, money } from '../lib/format';

/** Hero card for the signed-in user's wallet. Handles loading / missing wallet. */
export function WalletHero({
  wallet,
  loading,
  error,
  label,
  meta,
  children,
}: {
  wallet: LedgerAccount | null | undefined;
  loading: boolean;
  error: string | null;
  label: string;
  meta?: { label: string; value: ReactNode }[];
  children?: ReactNode;
}) {
  if (error) {
    return (
      <Banner tone="rose" title="Couldn't load your wallet">
        {error}
      </Banner>
    );
  }

  if (!loading && wallet === null) {
    return (
      <div className="wallet-hero">
        <div className="wallet-label">
          <WalletCards size={16} /> {label}
        </div>
        <div className="wallet-amount faint" style={{ fontSize: '1.5rem' }}>
          No wallet provisioned
        </div>
        <p className="muted" style={{ margin: '8px 0 0', position: 'relative', zIndex: 1, fontSize: '0.875rem' }}>
          Your account doesn't have a ledger wallet yet. Ask a hub admin to provision one — balances appear here once it
          exists.
        </p>
      </div>
    );
  }

  return (
    <div className="wallet-hero">
      <div className="wallet-label">
        <Wallet size={16} /> {label}
      </div>
      <div className="wallet-amount">
        {loading && wallet === undefined ? <Skeleton width={220} height={40} /> : money(wallet?.balance)}
      </div>
      <div className="wallet-meta">
        {meta?.map((m) => (
          <div key={m.label}>
            {m.label}
            <b>{m.value}</b>
          </div>
        ))}
        {wallet && (
          <div>
            Last movement
            <b>{dateTime(wallet.updatedAt)}</b>
          </div>
        )}
      </div>
      {children && <div style={{ marginTop: 20, position: 'relative', zIndex: 1 }}>{children}</div>}
    </div>
  );
}
