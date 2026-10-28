import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, clearSession, getStoredUser, getToken, storeSession } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('hd:unauthorized', logout);
    return () => window.removeEventListener('hd:unauthorized', logout);
  }, [logout]);

  const authenticate = useCallback(async (fn, email, password) => {
    const { token, user: u } = await fn(email, password);
    storeSession(token, u);
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({
      user,
      login: (e, p) => authenticate(api.login, e, p),
      register: (e, p) => authenticate(api.register, e, p),
      logout,
    }),
    [user, authenticate, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireAuth({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}
