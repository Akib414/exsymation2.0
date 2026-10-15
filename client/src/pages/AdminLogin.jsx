import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAdminAuth } from "../auth/AdminAuthContext.jsx";

export default function AdminLogin() {
  const { adminLogin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    // Mirrors backend adminLoginSchema: trimmed, lowercased, 1-64 chars.
    if (!username.trim()) {
      setError("Enter your admin username.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      // Backend returns generic "Invalid credentials" — never reveals if username exists.
      await adminLogin(username.trim().toLowerCase(), password);
      navigate(location.state?.from || "/admin", { replace: true });
    } catch (err) {
      // Surface field-level details when the API returns them.
      const details = err.response?.data?.details?.fieldErrors;
      const firstDetail =
        (details && (details.username?.[0] || details.password?.[0])) || null;
      setError(firstDetail || err.response?.data?.error || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
      <section className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]" aria-label="Admin sign in">
        <div className="mb-7 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f4] text-xl font-extrabold text-[#232329]">
            E
          </span>
          <span className="text-[17px] font-bold">Exsymation · Admin</span>
        </div>

        <h1 className="mb-2 text-3xl font-bold">Admin sign in</h1>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">Use your admin username to continue.</p>

        <form onSubmit={onSubmit} noValidate>
          <label className="mb-2 block text-sm font-semibold" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            placeholder="admin"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] text-[#f2f2f4] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <div className="flex items-baseline justify-between">
            <label className="mb-2 block text-sm font-semibold" htmlFor="password">
              Password
            </label>
            <span className="invisible text-sm underline" aria-hidden="true">
              Forgot password?
            </span>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mb-6 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] pr-[76px] text-[15px] text-[#f2f2f4] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute top-2 right-2 cursor-pointer border-0 bg-transparent px-2.5 py-2 text-sm text-[#d7d7dd]"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

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
            {busy ? "Signing in…" : "Login as admin"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[#b9b9c2]">
          <Link className="underline text-[#f2f2f4]" to="/login">
            Back to teacher sign in
          </Link>
        </p>

        <p className="mt-[26px] text-center text-[13px] leading-relaxed text-[#b9b9c2]">
          Department of Computer Science and Engineering
          <br />
          Jahangirnagar University
        </p>
      </section>
    </main>
  );
}
