import { useState } from 'react';
import { LayoutDashboard, Package } from 'lucide-react';
import { Shell, type NavItem } from '../../components/Shell';
import { useAsync } from '../../hooks/useAsync';
import { useRouteTab } from '../../hooks/useRouteTab';
import { Api } from '../../api/endpoints';
import { ErrorState, Loading, Panel } from '../../components/ui';
import { MerchantOverview } from './MerchantOverview';
import { MerchantParcels } from './MerchantParcels';

export type MerchantTab = 'overview' | 'parcels';
const MERCHANT_TABS: readonly MerchantTab[] = ['overview', 'parcels'];
const MERCHANT_ALIASES: Record<string, MerchantTab> = { create: 'parcels', 'new-parcel': 'parcels', new: 'parcels' };

export function MerchantView() {
  const [tab, setTab] = useRouteTab(MERCHANT_TABS, 'overview', MERCHANT_ALIASES);
  const [createOpen, setCreateOpen] = useState(false);
  // merchantId for creating/listing parcels comes from the Merchant profile, not the User.
  const profile = useAsync(() => Api.merchants.me(), []);

  const nav: NavItem<MerchantTab>[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'parcels', label: 'Parcels', icon: Package },
  ];

  const handleNavigate = (next: MerchantTab) => {
    setCreateOpen(false);
    setTab(next);
  };

  return (
    <Shell nav={nav} active={tab} onNavigate={handleNavigate}>
      {profile.error ? (
        <Panel title="Merchant profile unavailable">
          <ErrorState message={profile.error} onRetry={profile.reload} />
        </Panel>
      ) : !profile.data ? (
        <Loading label="Loading your merchant profile…" />
      ) : (
        <>
          {tab === 'overview' && (
            <MerchantOverview
              merchant={profile.data}
              onNavigate={handleNavigate}
              onNewParcel={() => {
                setTab('parcels');
                setCreateOpen(true);
              }}
            />
          )}
          {tab === 'parcels' && (
            <MerchantParcels
              merchant={profile.data}
              createOpen={createOpen}
              onCreateOpenChange={setCreateOpen}
            />
          )}
        </>
      )}
    </Shell>
  );
}
