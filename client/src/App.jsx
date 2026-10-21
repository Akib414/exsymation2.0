import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { AdminAuthProvider, useAdminAuth } from "./auth/AdminAuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminProtectedRoute from "./components/AdminProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ChairmanDashboard from "./pages/ChairmanDashboard.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";

function PublicOnly({ children }) {
  const { isAuthenticated, restoring, mustChangePassword } = useAuth();
  if (restoring) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
        <p className="text-[15px] text-[#b9b9c2]">Loading…</p>
      </main>
    );
  }
  if (isAuthenticated) {
    return <Navigate to={mustChangePassword ? "/change-password" : "/"} replace />;
  }
  return children;
}

function AdminPublicOnly({ children }) {
  const { isAdminAuthenticated, restoring } = useAdminAuth();
  if (restoring) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
        <p className="text-[15px] text-[#b9b9c2]">Loading…</p>
      </main>
    );
  }
  if (isAdminAuthenticated) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        {/* Example role-gated page: chairman-only sees this only in UI; API enforces it. */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chairman"
          element={
            <ProtectedRoute roles={["chairman"]}>
              <ChairmanDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/login"
          element={
            <AdminPublicOnly>
              <AdminLogin />
            </AdminPublicOnly>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AdminAuthProvider>
    </AuthProvider>
  );
}
