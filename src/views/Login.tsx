import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  AtSign,
  Bike,
  Eye,
  EyeOff,
  Lock,
  PackageCheck,
  ShieldCheck,
  Smartphone,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Shell';
import { Banner, Spinner } from '../components/ui';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/format';
import type { Tone } from '../lib/status';

interface Demo {
  id: string;
  label: string;
  description: string;
  identifier: string;
  password: string;
  icon: LucideIcon;
  tone: Tone;
}

const DEMOS: Demo[] = [
  {
    id: 'admin',
    label: 'Hub admin',
    description: 'Assign couriers, confirm cash settlements',
    identifier: 'admin@scribe.local',
    password: 'Admin@Scribe2026',
    icon: ShieldCheck,
    tone: 'gold',
  },
  {
    id: 'courier',
    label: 'Courier',
    description: 'Run deliveries, collect COD, settle cash',
    identifier: 'courier1@scribe.local',
    password: 'Courier@2026',
    icon: Bike,
    tone: 'teal',
  },
  {
    id: 'merchant',
    label: 'Merchant',
    description: 'Ship parcels and track payouts',
    identifier: 'merchant1@scribe.local',
    password: 'Merchant@2026',
    icon: Store,
    tone: 'violet',
  },
];

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // 'form' or a demo id
  const [error, setError] = useState<string | null>(null);

  const isEmail = identifier.includes('@');

  const signIn = async (id: string, pw: string, source: string) => {
    setPending(source);
    setError(null);
    try {
      const user = await login(id, pw);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
    } catch (e) {
      setError(errorMessage(e));
      setPending(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Enter your email or phone number and password.');
      return;
    }
    void signIn(identifier, password, 'form');
  };

  return (
    <div className="login">
      <section className="login-hero" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        <div className="brand" style={{ position: 'relative', padding: 0 }}>
          <Logo />
          <div>
            <div className="brand-name">Scribe</div>
            <div className="brand-sub">Smart Logistics Hub</div>
          </div>
        </div>

        <div className="hero-content">
          <div className="eyebrow">Armant · Luxor</div>
          <div className="hero-title">
            Every parcel.
            <br />
            Every pound. <span className="grad-text">Accounted for.</span>
          </div>
          <p className="hero-sub">
            The operations console for the Armant hub — from merchant pickup to doorstep cash collection and the
            end-of-day handover.
          </p>

          <svg className="route" viewBox="0 0 560 120" fill="none">
            <defs>
              <linearGradient id="route-g" x1="0" x2="1">
                <stop offset="0" stopColor="hsl(40 95% 62%)" />
                <stop offset="1" stopColor="hsl(258 85% 72%)" />
              </linearGradient>
            </defs>
            <path className="dash" d="M20 90 C 140 90, 160 30, 280 30 S 420 90, 540 40" stroke="url(#route-g)" strokeWidth="2.5" strokeLinecap="round" />
            {[
              [20, 90],
              [280, 30],
              [540, 40],
            ].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="12" fill="hsla(40,95%,62%,0.12)" />
                <circle cx={x} cy={y} r="5" fill={i === 2 ? 'hsl(258 85% 72%)' : 'hsl(40 95% 62%)'} />
              </g>
            ))}
          </svg>

          <div className="hero-features">
            {[
              { icon: PackageCheck, tone: 'gold', text: 'Live parcel pipeline from pickup to delivery' },
              { icon: Wallet, tone: 'teal', text: 'Double-entry COD ledger for couriers & merchants' },
              { icon: ShieldCheck, tone: 'violet', text: 'Audited cash settlements at the hub' },
            ].map((f) => (
              <div key={f.text} className="hero-feature">
                <div className={`stat-icon tone-${f.tone}`}>
                  <f.icon size={17} />
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div className="hero-foot">© {new Date().getFullYear()} Scribe Logistics · Armant, Luxor Governorate</div>
      </section>

      <section className="login-panel">
        <div className="login-card fade-in">
          <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Sign in to Scribe
          </h1>
          <h2>Sign in</h2>
          <p className="muted" style={{ margin: '6px 0 26px' }}>
            Use your email or Egyptian mobile number.
          </p>

          <form className="stack-sm" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label className="label" htmlFor="login-identifier">
                Email or phone
              </label>
              <div className="input-wrap">
                <span className="input-icon">{isEmail || !identifier ? <AtSign size={17} /> : <Smartphone size={17} />}</span>
                <input
                  id="login-identifier"
                  className="input"
                  type="text"
                  inputMode={isEmail || !identifier ? 'email' : 'tel'}
                  autoComplete="username"
                  placeholder="you@scribe.local or 010 1234 5678"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="login-password">
                Password
              </label>
              <div className="input-wrap has-action">
                <span className="input-icon">
                  <Lock size={17} />
                </span>
                <input
                  id="login-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm input-action"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <Banner tone="rose">{error}</Banner>}

            <button id="login-submit" type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending !== null} style={{ marginTop: 6 }}>
              {pending === 'form' ? <Spinner size={16} /> : null}
              {pending === 'form' ? 'Signing in…' : 'Sign in'}
              {pending !== 'form' && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="divider">One-click demo</div>

          <div className="demo-grid">
            {DEMOS.map((d) => (
              <button
                key={d.id}
                id={`demo-login-${d.id}`}
                className={`demo tone-${d.tone}`}
                disabled={pending !== null}
                onClick={() => {
                  setIdentifier(d.identifier);
                  setPassword(d.password);
                  void signIn(d.identifier, d.password, d.id);
                }}
              >
                <div className="stat-icon">
                  <d.icon size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="demo-title">{d.label}</div>
                  <div className="demo-sub">{d.description}</div>
                </div>
                <span className="demo-go">{pending === d.id ? <Spinner size={16} /> : <ArrowRight size={17} />}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
