import axios from "axios";

// Same-origin by default so the Vite dev proxy ("/api" -> :3000) is used.
// Set VITE_API_BASE=http://localhost:3000 for direct API use.
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE || "").replace(/\/$/, ""),
  withCredentials: true,
});

// Access token lives in memory only — never localStorage/sessionStorage.
let accessToken = null;
let refreshPromise = null;

function getAccessToken() {
  return accessToken;
}

function setAccessToken(token) {
  accessToken = token || null;
}

function clearAccessToken() {
  accessToken = null;
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

// Attach the in-memory token to every API call.
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// On 401: try one silent refresh (single-flight), retry the request once,
// otherwise clear the token and let the route guard send the user to /login.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const url = String(original.url || "");
    const status = error.response?.status;

    // Never intercept the auth endpoints themselves (avoids refresh loops).
    if (status !== 401 || original._retried || url.includes("/api/auth/")) {
      return Promise.reject(error);
    }
    original._retried = true;
    const token = await silentRefresh();
    if (!token) return Promise.reject(error);
    original.headers = original.headers || {};
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  }
);

export default api;
export { getAccessToken, setAccessToken, clearAccessToken, silentRefresh };
