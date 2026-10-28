import { useCallback, useEffect, useState } from 'react';

/**
 * Synchronizes a view tab state with the browser URL pathname (History API).
 * Supports direct URL entry (e.g. /parcels, /overview), page reloads,
 * and browser Back/Forward navigation.
 */
export function useRouteTab<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  aliases: Record<string, T> = {},
): [T, (next: T) => void] {
  const resolveFromUrl = useCallback((): T => {
    const raw = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!raw) return defaultTab;
    if ((validTabs as readonly string[]).includes(raw)) {
      return raw as T;
    }
    if (raw in aliases) {
      return aliases[raw];
    }
    return defaultTab;
  }, [validTabs, defaultTab, aliases]);

  const [tab, setTab] = useState<T>(() => resolveFromUrl());

  // Sync canonical URL on mount if current pathname doesn't match resolved tab
  useEffect(() => {
    const resolved = resolveFromUrl();
    setTab(resolved);
    const currentRaw = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const targetPath = resolved === defaultTab && currentRaw === '' ? '/' : `/${resolved}`;
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
  }, [resolveFromUrl, defaultTab]);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const onPopState = () => {
      setTab(resolveFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [resolveFromUrl]);

  const navigate = useCallback(
    (next: T) => {
      setTab(next);
      const targetPath = `/${next}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    },
    [],
  );

  return [tab, navigate];
}

