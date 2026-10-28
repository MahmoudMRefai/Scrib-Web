import { useState } from 'react';
import { LayoutDashboard, Package, PackagePlus } from 'lucide-react';
import { Shell, type NavItem } from '../../components/Shell';
import { useAsync } from '../../hooks/useAsync';
import { Api } from '../../api/endpoints';
import { ErrorState, Loading, Panel } from '../../components/ui';
import { MerchantOverview } from './MerchantOverview';
import { CreateParcel } from './CreateParcel';
import { MerchantParcels } from './MerchantParcels';

export type MerchantTab = 'overview' | 'create' | 'parcels';

export function MerchantView() {
  const [tab, setTab] = useState<MerchantTab>('overview');
  // merchantId for creating/listing parcels comes from the Merchant profile, not the User.
  const profile = useAsync(() => Api.merchants.me(), []);

  const nav: NavItem<MerchantTab>[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'create', label: 'New parcel', icon: PackagePlus },
    { key: 'parcels', label: 'My parcels', icon: Package },
  ];

  return (
    <Shell nav={nav} active={tab} onNavigate={setTab}>
      {profile.error ? (
        <Panel title="Merchant profile unavailable">
          <ErrorState message={profile.error} onRetry={profile.reload} />
        </Panel>
      ) : !profile.data ? (
        <Loading label="Loading your merchant profile…" />
      ) : (
        <>
          {tab === 'overview' && <MerchantOverview merchant={profile.data} onNavigate={setTab} />}
          {tab === 'create' && <CreateParcel merchant={profile.data} onCreated={() => setTab('parcels')} />}
          {tab === 'parcels' && <MerchantParcels merchant={profile.data} onNavigate={setTab} />}
        </>
      )}
    </Shell>
  );
}
