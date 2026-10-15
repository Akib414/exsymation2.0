import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import api, {
  setAdminAccessToken,
  clearAdminAccessToken,
  silentAdminRefresh,
} from "../api/client.js";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [restoring, setRestoring] = useState(true);

  // App load: POST /api/admin/refresh (cookie only) to restore the session.
  // Backend has no GET /api/admin/me, so we only know "authenticated",
  // plus the username remembered from the last login in this tab session.
  useEffect(() => {
    (async () => {
      try {
        const token = await silentAdminRefresh();
        if (token) {
          const username = sessionStorage.getItem("adminUsername");
          setAdmin(username ? { username, type: "admin" } : { type: "admin" });
        }
      } catch {
        clearAdminAccessToken();
        setAdmin(null);
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const adminLogin = useCallback(async (username, password) => {
    const { data } = await api.post("/api/admin/login", { username, password });
    setAdminAccessToken(data.accessToken);
    const record = { username: username.trim().toLowerCase(), type: "admin" };
    sessionStorage.setItem("adminUsername", record.username);
    setAdmin(record);
    return { ...data, admin: record };
  }, []);

  const adminLogout = useCallback(async () => {
    try {
      await api.post("/api/admin/logout");
    } catch {
      // Always clear local state even if the network fails.
    }
    clearAdminAccessToken();
    sessionStorage.removeItem("adminUsername");
    setAdmin(null);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await api.post("/api/admin/change-password", { currentPassword, newPassword });
    // Backend revokes all sessions on password change — re-login is required.
    clearAdminAccessToken();
    sessionStorage.removeItem("adminUsername");
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({
      admin,
      restoring,
      isAdminAuthenticated: Boolean(admin),
      adminLogin,
      adminLogout,
      changePassword,
    }),
    [admin, restoring, adminLogin, adminLogout, changePassword]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  return ctx;
}
