import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import api, { setAccessToken, clearAccessToken, silentRefresh } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  const loadMe = useCallback(async () => {
    const { data } = await api.get("/api/me");
    setUser(data);
    return data;
  }, []);

  // App load: POST /refresh (cookie only), then GET /me to restore the session.
  useEffect(() => {
    (async () => {
      try {
        const token = await silentRefresh();
        if (token) await loadMe();
      } catch {
        clearAccessToken();
        setUser(null);
      } finally {
        setRestoring(false);
      }
    })();
  }, [loadMe]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post("/api/auth/login", { email, password });
      setAccessToken(data.accessToken);
      const me = await loadMe();
      return { ...data, user: me };
    },
    [loadMe]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Always clear local state even if the network fails.
    }
    clearAccessToken();
    setUser(null);
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.post("/api/auth/logout-all");
    } catch {
      // Same as logout — clear locally regardless.
    }
    clearAccessToken();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await api.post("/api/auth/change-password", { currentPassword, newPassword });
    // Backend revokes all sessions on password change — re-login is required.
    clearAccessToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      roles: user?.roles || [],
      mustChangePassword: Boolean(user?.mustChangePassword),
      restoring,
      isAuthenticated: Boolean(user),
      login,
      logout,
      logoutAll,
      changePassword,
      refreshUser: loadMe,
    }),
    [user, restoring, login, logout, logoutAll, changePassword, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
