import { request } from './client';
import type {
  AuthResult,
  CourierList,
  CreateParcelInput,
  LedgerAccount,
  Merchant,
  MerchantList,
  Parcel,
  ParcelList,
  ParcelStatus,
  Settlement,
  SettlementList,
  SettlementStatus,
  AccountOwnerType,
} from './types';

export interface ParcelQuery {
  status?: ParcelStatus;
  merchantId?: string;
  courierId?: string;
  page?: number;
  pageSize?: number;
}

export interface SettlementQuery {
  status?: SettlementStatus;
  courierId?: string;
  page?: number;
  pageSize?: number;
}

export const Api = {
  auth: {
    login: (body: { email?: string; phone?: string; password: string }) =>
      request<AuthResult>('/auth/login', { method: 'POST', body }),
  },

  parcels: {
    // NOTE: the backend does not scope this by role — callers must pass
    // merchantId / courierId themselves for merchant and courier views.
    list: (query: ParcelQuery = {}) => request<ParcelList>('/parcels', { query: { ...query } }),
    create: (body: CreateParcelInput) => request<Parcel>('/parcels', { method: 'POST', body }),
    updateStatus: (id: string, status: ParcelStatus) =>
      request<Parcel>(`/parcels/${id}/status`, { method: 'PATCH', body: { status } }),
    /** `courierUserId` is the courier's *User* id (Courier.userId), not Courier.id. */
    assign: (id: string, courierUserId: string) =>
      request<Parcel>(`/parcels/${id}/assign`, { method: 'PATCH', body: { courierId: courierUserId } }),
  },

  couriers: {
    list: (page = 1, pageSize = 20) => request<CourierList>('/couriers', { query: { page, pageSize } }),
  },

  merchants: {
    list: (page = 1, pageSize = 20) => request<MerchantList>('/merchants', { query: { page, pageSize } }),
    me: () => request<Merchant>('/merchants/me'),
  },

  wallets: {
    /** Admin only. Returns a plain array (not paginated). */
    list: (query: { ownerType?: AccountOwnerType; ownerId?: string } = {}) =>
      request<LedgerAccount[]>('/wallets', { query: { ...query } }),
    /** Returns the caller's ledger accounts; 404 NOT_FOUND if none exist. */
    mine: () => request<LedgerAccount[]>('/wallets/me'),
  },

  settlements: {
    list: (query: SettlementQuery = {}) => request<SettlementList>('/settlements', { query: { ...query } }),
    /** `courierId` is the courier's User id. */
    initiate: (body: { courierId: string; amount: number; notes?: string }) =>
      request<Settlement>('/settlements', { method: 'POST', body }),
    confirm: (id: string, notes?: string) =>
      request<Settlement>(`/settlements/${id}/confirm`, { method: 'PATCH', body: { notes: notes || undefined } }),
    dispute: (id: string, reason: string) =>
      request<Settlement>(`/settlements/${id}/dispute`, { method: 'PATCH', body: { reason } }),
  },
};
