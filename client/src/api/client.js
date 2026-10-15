import axios from "axios";

// Same-origin by default so the Vite dev proxy ("/api" -> :3000) is used.
// Set VITE_API_BASE=http://localhost:3000 for direct API use.
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE || "").replace(/\/$/, ""),
  withCredentials: true,
});

// Access token lives in memory only — never localStorage/sessionStorage.
// Teacher and admin tokens are tracked separately so the two logins never clash.
let accessToken = null;
let adminAccessToken = null;
let refreshPromise = null;
let adminRefreshPromise = null;

function getAccessToken() {
  return accessToken;
}

function setAccessToken(token) {
  accessToken = token || null;
}

function clearAccessToken() {
  accessToken = null;
}

function getAdminAccessToken() {
  return adminAccessToken;
}

function setAdminAccessToken(token) {
  adminAccessToken = token || null;
}

function clearAdminAccessToken() {
  adminAccessToken = null;
}

async function silentRefresh() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/api/auth/refresh")
      .then((res) => {
        setAccessToken(res.data?.accessToken || null);
        return res.data?.accessToken || null;
      })
      .catch(() => {
        clearAccessToken();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function silentAdminRefresh() {
  if (!adminRefreshPromise) {
    adminRefreshPromise = api
      .post("/api/admin/refresh")
      .then((res) => {
        setAdminAccessToken(res.data?.accessToken || null);
        return res.data?.accessToken || null;
      })
      .catch(() => {
        clearAdminAccessToken();
        return null;
      })
      .finally(() => {
        adminRefreshPromise = null;
      });
  }
  return adminRefreshPromise;
}

// Attach the right in-memory token to every API call.
// Admin endpoints use the admin token, everything else uses the teacher token.
// Never overwrite an explicitly set Authorization header.
api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  if (config.headers.Authorization) return config;
  const url = String(config.url || "");
  if (url.startsWith("/api/admin") && adminAccessToken) {
    config.headers.Authorization = `Bearer ${adminAccessToken}`;
  } else if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// On 401: try one silent refresh (single-flight), retry the request once,
// otherwise clear the token and let the route guard send the user to login.
// Teacher and admin refresh flows are kept independent.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const url = String(original.url || "");
    const status = error.response?.status;
    if (status !== 401 || original._retried) {
      return Promise.reject(error);
    }

    // Never intercept the auth endpoints themselves (avoids refresh loops).
    if (url.includes("/api/auth/") || url.includes("/api/admin/login") || url.includes("/api/admin/refresh")) {
      return Promise.reject(error);
    }
    original._retried = true;

    if (url.startsWith("/api/admin")) {
      const token = await silentAdminRefresh();
      if (!token) return Promise.reject(error);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }

    const token = await silentRefresh();
    if (!token) return Promise.reject(error);
    original.headers = original.headers || {};
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  }
);

export default api;
export { getAccessToken, setAccessToken, clearAccessToken, silentRefresh };
export {
  getAdminAccessToken,
  setAdminAccessToken,
  clearAdminAccessToken,
  silentAdminRefresh,
};
