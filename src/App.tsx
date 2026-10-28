import { useAuth } from './auth/AuthContext';
import { Login } from './views/Login';
import { AdminView } from './views/admin/AdminView';
import { MerchantView } from './views/merchant/MerchantView';
import { CourierView } from './views/courier/CourierView';

/** One app, one view per role. */
export default function App() {
  const { session } = useAuth();
  if (!session) return <Login />;

  switch (session.user.role) {
    case 'ADMIN':
      return <AdminView />;
    case 'MERCHANT':
      return <MerchantView />;
    case 'COURIER':
      return <CourierView />;
  }
}
