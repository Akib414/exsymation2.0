import { useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/client.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Generic response by design — no user enumeration.
      await api.post("/api/auth/forgot-password", { email: email.trim() });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
      <section className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]" aria-label="Forgot password">
        <h1 className="mb-2 text-3xl font-bold">Forgot password</h1>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">
          {done ? "If the email exists, a reset link was sent." : "Enter your university email."}
        </p>
        {!done && (
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
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link className="underline" to="/login">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
