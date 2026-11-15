import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { api, setUnauthorizedHandler } from '../api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);
const SIGNED_OUT = { role: null, user: null };

/** Who is signed in. The server owns the session cookie; the page just asks /api/auth/me. */
export function AuthProvider({ children }) {
  const toast = useToast();
  const [session, setSession] = useState(SIGNED_OUT);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    api('/api/auth/me')
      .then((data) => setSession({ role: data.role, user: data.user || data.admin || null }))
      .catch(() => setSession(SIGNED_OUT))
      .finally(() => setIsReady(true));
  }, []);

  const roleRef = useRef(null);
  roleRef.current = session.role;

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!roleRef.current) return;
      toast.info('Your session ended. Please sign in again.');
      setSession(SIGNED_OUT);
    });
  }, [toast]);

  const start = useCallback(async (path, body) => {
    const data = await api(path, { method: 'POST', body });
    const next = { role: data.admin ? 'admin' : 'user', user: data.user || data.admin };
    setSession(next);
    return next;
  }, []);

  const value = useMemo(() => ({
    ...session,
    isReady,
    isAdmin: session.role === 'admin',
    isCustomer: session.role === 'user',
    signIn: (email, password) => start('/api/auth/login', { email, password }),
    signUp: (form) => start('/api/auth/register', form),
    signInAdmin: (username, password) => start('/api/auth/admin-login', { username, password }),
    signOut: async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      setSession(SIGNED_OUT);
    },
  }), [session, isReady, start]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
