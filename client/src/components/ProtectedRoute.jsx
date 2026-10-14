import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";

// UI-only visibility guard — the backend is the real enforcement.
// roles: require ANY of the listed roles (backend requireAnyRole semantics).
// Must-change-password users are forced to /change-password first.
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, restoring, roles: userRoles, mustChangePassword } = useAuth();
  const location = useLocation();

  if (restoring) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
        <p className="text-[15px] text-[#b9b9c2]">Loading…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (roles && roles.length > 0 && !roles.some((r) => userRoles.includes(r))) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
        <section className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 text-center">
          <h1 className="mb-2 text-2xl font-bold">Forbidden</h1>
          <p className="text-[15px] text-[#b9b9c2]">You do not have access to this page.</p>
        </section>
      </main>
    );
  }

  return children;
}
