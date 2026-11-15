import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

/** Route guard for the UI. The API enforces the same rule; this only avoids showing a page that cannot load. */
export default function RequireRole({ role, children }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.isReady) return <div className="page-center"><Spinner /></div>;
  if (auth.role !== role) {
    const target = role === 'admin' ? '/login?admin=1' : '/login';
    return <Navigate to={target} replace state={{ from: location.pathname }} />;
  }
  return children;
}
