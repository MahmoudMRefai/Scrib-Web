import { HandCoins, Route } from 'lucide-react';
import { Shell, type NavItem } from '../../components/Shell';
import { useRouteTab } from '../../hooks/useRouteTab';
import { CourierDeliveries } from './CourierDeliveries';
import { CourierWallet } from './CourierWallet';

export type CourierTab = 'deliveries' | 'wallet';
const COURIER_TABS: readonly CourierTab[] = ['deliveries', 'wallet'];
const COURIER_ALIASES: Record<string, CourierTab> = {
  overview: 'deliveries',
  parcels: 'deliveries',
  wallets: 'wallet',
  settlements: 'wallet',
};

export function CourierView() {
  const [tab, setTab] = useRouteTab(COURIER_TABS, 'deliveries', COURIER_ALIASES);

  const nav: NavItem<CourierTab>[] = [
    { key: 'deliveries', label: 'My deliveries', icon: Route },
    { key: 'wallet', label: 'Wallet & settlement', icon: HandCoins },
  ];

  return (
    <Shell nav={nav} active={tab} onNavigate={setTab}>
      {tab === 'deliveries' && <CourierDeliveries onNavigate={setTab} />}
      {tab === 'wallet' && <CourierWallet />}
    </Shell>
  );
}
