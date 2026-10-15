import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAdminAuth } from "../../auth/AdminAuthContext.jsx";

export default function ChangePasswordPanel() {
  const { changePassword } = useAdminAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from the current one.");
      return;
    }
    setBusy(true);
    try {
      // Backend revokes all sessions here — you will sign in again.
      await changePassword(currentPassword, newPassword);
      navigate("/admin/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Password change failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-center">
    <div className="w-full max-w-[460px]">
      <h1 className="mb-2 text-2xl font-bold">Change password</h1>
      <p className="mb-[26px] text-[15px] text-[#b9b9c2]">
        You will be signed out and must sign in again.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <label className="mb-2 block text-sm font-semibold" htmlFor="cp-current">
          Current password
        </label>
        <input
          id="cp-current"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
        />

        <label className="mb-2 block text-sm font-semibold" htmlFor="cp-new">
          New password
        </label>
        <input
          id="cp-new"
          type="password"
          autoComplete="new-password"
          placeholder="Minimum 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
        />

        <label className="mb-2 block text-sm font-semibold" htmlFor="cp-confirm">
          Confirm new password
        </label>
        <input
          id="cp-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
    </div>
    </div>
  );
}
