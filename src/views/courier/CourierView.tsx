import { useState } from 'react';
import { HandCoins, Route } from 'lucide-react';
import { Shell, type NavItem } from '../../components/Shell';
import { CourierDeliveries } from './CourierDeliveries';
import { CourierWallet } from './CourierWallet';

export type CourierTab = 'deliveries' | 'wallet';

export function CourierView() {
  const [tab, setTab] = useState<CourierTab>('deliveries');

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
