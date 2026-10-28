import { request } from './client';
import type {
  AuthResult,
  CourierList,
  CourierWalletSummary,
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
  Payout,
  PayoutList,
  PayoutStatus,
  PayoutRecipientType,
  RecipientBalancesResponse,
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

export interface PayoutQuery {
  status?: PayoutStatus;
  recipientId?: string;
  recipientType?: PayoutRecipientType;
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
    myWallet: (limit = 20) => request<CourierWalletSummary>('/couriers/me/wallet', { query: { limit } }),
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

  payouts: {
    list: (query: PayoutQuery = {}) => request<PayoutList>('/payouts', { query: { ...query } }),
    request: (body: { amount: number; notes?: string }) =>
      request<Payout>('/payouts', { method: 'POST', body }),
    sendDirect: (body: { recipientId: string; amount: number; notes?: string }) =>
      request<Payout>('/payouts/send', { method: 'POST', body }),
    balances: () =>
      request<RecipientBalancesResponse>('/payouts/balances'),
    disburse: (id: string, notes?: string) =>
      request<Payout>(`/payouts/${id}/disburse`, { method: 'PATCH', body: { notes: notes || undefined } }),
    confirm: (id: string) =>
      request<Payout>(`/payouts/${id}/confirm`, { method: 'PATCH', body: {} }),
    reject: (id: string, reason?: string) =>
      request<Payout>(`/payouts/${id}/reject`, { method: 'PATCH', body: { reason } }),
  },
};
