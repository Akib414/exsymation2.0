import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    // Friendly client-side check: the API only accepts email format (not phone/numbers).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid university email address (e.g. name@university.edu).");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      // Backend returns generic "Invalid credentials" — never reveals if email exists.
      const result = await login(email.trim(), password);
      if (result.mustChangePassword) {
        navigate("/change-password", { replace: true });
      } else {
        navigate(location.state?.from || "/", { replace: true });
      }
    } catch (err) {
      // Surface field-level details when the API returns them (e.g. bad email format).
      const details = err.response?.data?.details?.fieldErrors;
      const firstDetail =
        (details && (details.email?.[0] || details.password?.[0])) || null;
      setError(firstDetail || err.response?.data?.error || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
      <section className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]" aria-label="Sign in">
        <div className="mb-7 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f4] text-xl font-extrabold text-[#232329]">
            E
          </span>
          <span className="text-[17px] font-bold">Exsymation</span>
        </div>

        <h1 className="mb-2 text-3xl font-bold">Sign in</h1>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">Use your university email to continue.</p>

        <form onSubmit={onSubmit} noValidate>
          <label className="mb-2 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="name@university.edu"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] text-[#f2f2f4] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <div className="flex items-baseline justify-between">
            <label className="mb-2 block text-sm font-semibold" htmlFor="password">
              Password
            </label>
            <Link className="text-sm text-[#f2f2f4] underline" to="/forgot-password">
              Forgot password?
            </Link>
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
            {busy ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="mt-[26px] text-center text-[13px] leading-relaxed text-[#b9b9c2]">
          Department of Computer Science and Engineering
          <br />
          Jahangirnagar University
        </p>
      </section>
    </main>
  );
}
