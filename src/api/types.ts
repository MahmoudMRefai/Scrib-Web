/**
 * Types mirroring Scribe Core responses.
 *
 * Prisma `Decimal` columns are serialized as strings over JSON
 * (e.g. "33000", "0.75"), so money/weight fields are typed as `string`.
 */

export type Role = 'ADMIN' | 'COURIER' | 'MERCHANT';

export type ParcelStatus =
  | 'PENDING'
  | 'PICKED_UP'
  | 'AT_HUB'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED_TO_ORIGIN';

export type SettlementStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED';
export type PayoutStatus = 'PENDING' | 'DISBURSED' | 'CONFIRMED' | 'REJECTED';
export type PayoutRecipientType = 'COURIER' | 'MERCHANT';
export type AccountOwnerType = 'COURIER' | 'MERCHANT' | 'SYSTEM';
export type AccountType = 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE';
export type VehicleType = 'MOTORCYCLE' | 'CAR' | 'BIKE' | 'VAN' | 'OTHER';

/** Decimal serialized by Prisma */
export type DecimalString = string;

export interface User {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  role: Role;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface Paginated {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Parcel {
  id: string;
  trackingId: string;
  merchantId: string;
  /** NOTE: this is a *User* id (the courier's user account), not a Courier row id. */
  courierId: string | null;
  status: ParcelStatus;
  codAmount: DecimalString;
  weight: DecimalString | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  notes: string | null;
  deliveredAt: string | null;
  courierCommission?: DecimalString | null;
  createdAt: string;
  updatedAt: string;
  /** Present on list responses only */
  merchant?: { id: string; businessName: string };
  courier?: { id: string; name: string } | null;
}

export interface ParcelList extends Paginated {
  parcels: Parcel[];
}

export interface CreateParcelInput {
  merchantId: string;
  codAmount: number;
  weight?: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  notes?: string;
}

export interface Courier {
  id: string;
  userId: string;
  isActive: boolean;
  phone: string | null;
  vehicleType: VehicleType | null;
  address: string | null;
  currentLocation: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; name: string };
}

export interface CourierList extends Paginated {
  couriers: Courier[];
}

export interface Merchant {
  id: string;
  userId: string;
  businessName: string;
  address: string | null;
  phone: string | null;
  flatDeliveryFee: DecimalString;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; name: string };
}

export interface MerchantList extends Paginated {
  merchants: Merchant[];
}

export interface LedgerAccount {
  id: string;
  ownerId: string;
  ownerType: AccountOwnerType;
  type: AccountType;
  name: string;
  balance: DecimalString;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; email: string; role: Role };
}

export interface Settlement {
  id: string;
  /** User id of the courier */
  courierId: string;
  adminId: string | null;
  amount: DecimalString;
  status: SettlementStatus;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  courier?: { id: string; name: string };
  admin?: { id: string; name: string } | null;
}

export interface CourierWalletTransaction {
  id: string;
  type: 'OPENING_BALANCE' | 'CASH_COLLECTED' | 'CASH_DEPOSITED' | 'COMMISSION_EARNED' | 'PAYOUT_SETTLED';
  amount: DecimalString;
  balanceAfter: DecimalString;
  referenceId: string | null;
  createdAt: string;
}

export interface CourierWalletSummary {
  walletId: string | null;
  totalEarnings: DecimalString;
  pendingPayout: DecimalString;
  cashInHand: DecimalString;
  updatedAt: string | null;
  transactions: CourierWalletTransaction[];
}

export interface SettlementList extends Paginated {
  settlements: Settlement[];
}

export interface Payout {
  id: string;
  recipientId: string;
  recipientType: PayoutRecipientType;
  adminId: string | null;
  amount: DecimalString;
  status: PayoutStatus;
  notes: string | null;
  disbursedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recipient?: { id: string; name: string; email: string; phone?: string | null; role: Role };
  admin?: { id: string; name: string } | null;
}

export interface PayoutList extends Paginated {
  payouts: Payout[];
}

export interface RecipientPayoutBalance {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  recipientType: PayoutRecipientType;
  totalBalance: DecimalString;
  pendingPayouts: DecimalString;
  availableBalance: DecimalString;
}

export interface RecipientBalancesResponse {
  couriers: RecipientPayoutBalance[];
  merchants: RecipientPayoutBalance[];
}
