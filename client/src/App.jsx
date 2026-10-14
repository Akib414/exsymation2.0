import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
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

export default function App() {
  return (
    <AuthProvider>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
