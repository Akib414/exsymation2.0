import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";

export default function ChangePassword() {
  const { changePassword, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      // Backend revokes all sessions here — you will sign in again.
      await changePassword(currentPassword, newPassword);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Password change failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
      <section className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]" aria-label="Change password">
        <h1 className="mb-2 text-3xl font-bold">Change password</h1>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">
          {mustChangePassword
            ? "Your account requires a password change before continuing."
            : "Choose a new password (min 8 characters)."}
        </p>
        <form onSubmit={onSubmit} noValidate>
          <label className="mb-2 block text-sm font-semibold" htmlFor="current">
            Current password
          </label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />
          <label className="mb-2 block text-sm font-semibold" htmlFor="next">
            New password
          </label>
          <input
            id="next"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="mb-6 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />
          {error && (
            <p role="alert" className="mb-4 rounded-[10px] border border-[#7a3b40] bg-[#4a2b2e] px-3 py-2.5 text-sm text-[#ffd9dc]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#f2f2f4] p-[15px] text-base font-semibold text-[#232329] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
        {!mustChangePassword && (
          <p className="mt-6 text-center text-sm">
            <Link className="underline" to="/">
              Back to home
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
