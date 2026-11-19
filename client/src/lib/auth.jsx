import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, whenLoggedOut } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    whenLoggedOut(logout);
    if (!getToken()) {
      setReady(true);
      return;
    }
    api('/auth/me')
      .then(setUser)
      .catch(logout)
      .finally(() => setReady(true));
  }, [logout]);

  // Used by login, company sign-up and accepting an invite: all return { token, user }.
  const signIn = useCallback(({ token, user: u }) => {
    setToken(token);
    setUser(u);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, logout }), [user, ready, signIn, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Where each role lands after logging in.
export const homeFor = (role) => ({ hr: '/hr', manager: '/review', employee: '/work' })[role] || '/';
