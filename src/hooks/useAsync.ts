import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { Api, type ParcelQuery } from '../api/endpoints';
import { ApiError } from '../api/client';
import type { CourierWalletSummary, LedgerAccount, ParcelStatus } from '../api/types';
import { PARCEL_STATUSES } from '../lib/status';
import { errorMessage } from '../lib/format';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** Re-run the loader, keeping current data visible while it refreshes. */
  reload: () => void;
}

/**
 * Runs an async loader whenever `deps` change. Stale responses from
 * superseded runs are discarded so fast filter changes can't race.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export interface StatusCounts {
  counts: Record<ParcelStatus, number>;
  total: number;
}

/**
 * There is no stats endpoint, so we ask the paginated list for each status
 * with pageSize=1 and read `total`. 7 tiny requests, run in parallel.
 */
export function useStatusCounts(scope: Pick<ParcelQuery, 'merchantId' | 'courierId'> | null, deps: DependencyList = []) {
  return useAsync<StatusCounts | null>(async () => {
    if (!scope) return null;
    const results = await Promise.all(
      PARCEL_STATUSES.map((status) => Api.parcels.list({ ...scope, status, page: 1, pageSize: 1 })),
    );
    const counts = Object.fromEntries(PARCEL_STATUSES.map((s, i) => [s, results[i].total])) as Record<ParcelStatus, number>;
    return { counts, total: results.reduce((sum, r) => sum + r.total, 0) };
  }, [scope?.merchantId, scope?.courierId, scope === null, ...deps]);
}

/**
 * The caller's primary (ASSET) wallet. Resolves to `null` — not an error —
 * when the backend reports no wallet exists for this user.
 */
export function useMyWallet(deps: DependencyList = []) {
  return useAsync<LedgerAccount | null>(async () => {
    try {
      const accounts = await Api.wallets.mine();
      return accounts.find((a) => a.type === 'ASSET') ?? accounts[0] ?? null;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_FOUND') return null;
      throw e;
    }
  }, deps);
}

/**
 * For Couriers: retrieves the courier's dedicated wallet summary (/couriers/me/wallet),
 * which includes totalEarnings (lifetime commission), pendingPayout (unpaid commission),
 * and cashInHand (collected COD owed to hub).
 */
export function useCourierWallet(limit = 20, deps: DependencyList = []) {
  return useAsync<CourierWalletSummary | null>(async () => {
    try {
      return await Api.couriers.myWallet(limit);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_FOUND') return null;
      throw e;
    }
  }, [limit, ...deps]);
}
