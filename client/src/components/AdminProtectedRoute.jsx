import { Navigate, useLocation } from "react-router-dom";

import { useAdminAuth } from "../auth/AdminAuthContext.jsx";

// UI-only visibility guard — the backend (protectAdmin) is the real enforcement.
export default function AdminProtectedRoute({ children }) {
  const { isAdminAuthenticated, restoring } = useAdminAuth();
  const location = useLocation();

  if (restoring) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
        <p className="text-[15px] text-[#b9b9c2]">Loading…</p>
      </main>
    );
  }

  if (!isAdminAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
