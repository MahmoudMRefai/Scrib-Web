import type { ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, RefreshCw, type LucideIcon } from 'lucide-react';
import type { ParcelStatus, PayoutStatus, SettlementStatus } from '../api/types';
import { PAYOUT_META, SETTLEMENT_META, STATUS_META, type Tone } from '../lib/status';
import { count } from '../lib/format';

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <Spinner size={20} />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14 }: { width?: number | string; height?: number }) {
  return <span className="skeleton" style={{ width, height }} />;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={24} />
      </div>
      <div className="empty-title">{title}</div>
      {message && <div className="empty-msg">{message}</div>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel-body">
      <Banner tone="rose" icon={AlertTriangle} title="Couldn't load this data">
        <div>{message}</div>
        {onRetry && (
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={onRetry}>
            <RefreshCw size={14} /> Try again
          </button>
        )}
      </Banner>
    </div>
  );
}

export function Banner({
  tone = 'sky',
  icon: Icon = AlertTriangle,
  title,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`banner tone-${tone}`}>
      <Icon size={18} />
      <div style={{ minWidth: 0 }}>
        {title && <div className="banner-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="row row-wrap">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  footer,
  className = '',
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <div className="panel-sub">{subtitle}</div>}
          </div>
          {actions && <div className="row row-wrap">{actions}</div>}
        </div>
      )}
      {children}
      {footer}
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'gold',
  hint,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className={`card stat tone-${tone}`}>
      <div className="stat-icon">
        <Icon size={18} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{loading ? <Skeleton width={90} height={28} /> : value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Pill({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`pill tone-${tone}`}>
      {dot && <span className="pill-dot" />}
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: ParcelStatus }) {
  const meta = STATUS_META[status];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function SettlementPill({ status }: { status: SettlementStatus }) {
  const meta = SETTLEMENT_META[status];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function PayoutPill({ status }: { status: PayoutStatus }) {
  const meta = PAYOUT_META[status];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  idPrefix = 'filter',
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  idPrefix?: string;
}) {
  return (
    <div className="chips" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          id={`${idPrefix}-${o.value.toLowerCase()}`}
          role="tab"
          aria-selected={o.value === value}
          className={`chip ${o.value === value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="chip-count">{count(o.count)}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  noun = 'items',
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pager">
      <span>
        Showing <b style={{ color: 'var(--text-2)' }}>{from}–{to}</b> of {count(total)} {noun}
      </span>
      <div className="row">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={14} />
        </button>
        <span>
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button className="btn btn-sm btn-ghost" onClick={onClick} disabled={loading} title="Refresh">
      {loading ? <Spinner size={14} /> : <RefreshCw size={14} />}
      Refresh
    </button>
  );
}
