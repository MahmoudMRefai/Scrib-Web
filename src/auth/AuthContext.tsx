import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Api } from '../api/endpoints';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import type { User } from '../api/types';
import { useToast } from '../components/Toast';

const STORAGE_KEY = 'scribe.session';

export interface Session {
  token: string;
  user: User;
}

interface AuthContextValue {
  session: Session | null;
  /** `identifier` is an email (contains "@") or an Egyptian mobile number. */
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.token || !s.user || isExpired(s.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Set synchronously so the very first child effects send the header.
    setAuthToken(s.token);
    return s;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(loadSession);

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const id = identifier.trim();
    const body = id.includes('@') ? { email: id.toLowerCase(), password } : { phone: id, password };
    const result = await Api.auth.login(body);
    const next: Session = { token: result.token, user: result.user };
    setAuthToken(next.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return result.user;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      toast.warning('Session expired', 'Please sign in again to continue.');
    });
    return () => setUnauthorizedHandler(null);
  }, [logout, toast]);

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For components rendered only when signed in. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('useSession called while signed out');
  return session;
}
