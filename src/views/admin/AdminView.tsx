import { Bike, HandCoins, LayoutDashboard, Package, Store, Wallet } from 'lucide-react';
import { Shell, type NavItem } from '../../components/Shell';
import { useAsync } from '../../hooks/useAsync';
import { useRouteTab } from '../../hooks/useRouteTab';
import { Api } from '../../api/endpoints';
import { AdminOverview } from './AdminOverview';
import { AdminParcels } from './AdminParcels';
import { AdminSettlements } from './AdminSettlements';
import { AdminCouriers } from './AdminCouriers';
import { AdminMerchants } from './AdminMerchants';
import { AdminWallets } from './AdminWallets';

export type AdminTab = 'overview' | 'parcels' | 'settlements' | 'couriers' | 'merchants' | 'wallets';
const ADMIN_TABS: readonly AdminTab[] = ['overview', 'parcels', 'settlements', 'couriers', 'merchants', 'wallets'];
const ADMIN_ALIASES: Record<string, AdminTab> = { payouts: 'settlements' };

export function AdminView() {
  const [tab, setTab] = useRouteTab(ADMIN_TABS, 'overview', ADMIN_ALIASES);
  // Drives the sidebar badge; refreshed whenever a settlement changes.
  const pending = useAsync(() => Api.settlements.list({ status: 'PENDING', pageSize: 1 }), []);

  const nav: NavItem<AdminTab>[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'parcels', label: 'Parcels', icon: Package },
    { key: 'settlements', label: 'Settlements', icon: HandCoins, badge: pending.data?.total },
    { key: 'couriers', label: 'Couriers', icon: Bike },
    { key: 'merchants', label: 'Merchants', icon: Store },
    { key: 'wallets', label: 'Wallets', icon: Wallet },
  ];

  return (
    <Shell nav={nav} active={tab} onNavigate={setTab}>
      {tab === 'overview' && <AdminOverview onNavigate={setTab} />}
      {tab === 'parcels' && <AdminParcels />}
      {tab === 'settlements' && <AdminSettlements onChange={pending.reload} />}
      {tab === 'couriers' && <AdminCouriers />}
      {tab === 'merchants' && <AdminMerchants />}
      {tab === 'wallets' && <AdminWallets />}
    </Shell>
  );
}
