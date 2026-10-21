import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Dashboard() {
  const { user, roles, logout, logoutAll } = useAuth();
  const [duties, setDuties] = useState(null);
  const [assignments, setAssignments] = useState(null);

  // Object-level data comes from /me/* — no teacher id is ever sent for identity.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, a] = await Promise.all([api.get("/api/me/duties"), api.get("/api/me/assignments")]);
        if (!cancelled) {
          setDuties(d.data?.data || []);
          setAssignments(a.data?.data || []);
        }
      } catch {
        if (!cancelled) {
          setDuties([]);
          setAssignments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#232329] p-6 text-[#f2f2f4]">
      <section className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.45)]" aria-label="Welcome">
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f4] text-xl font-extrabold text-[#232329]">
            E
          </span>
          <span className="text-[17px] font-bold">Exsymation</span>
        </div>
        <h1 className="mb-2 text-3xl font-bold">Welcome, {user?.name || "Teacher"}</h1>
        <p className="mb-4 text-[15px] text-[#b9b9c2]">{user?.email || "You are signed in."}</p>

        {roles.length > 0 && (
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {roles.map((r) => (
              <span key={r} className="rounded-full border border-[#55555f] bg-[#34333c] px-3 py-1 text-xs text-[#d7d7dd]">
                {r}
              </span>
            ))}
          </div>
        )}

        <p className="mb-6 text-sm text-[#b9b9c2]">
          {duties === null || assignments === null
            ? "Loading your duties…"
            : `${duties.length} invigilation ${duties.length === 1 ? "duty" : "duties"} · ${assignments.length} examiner ${assignments.length === 1 ? "assignment" : "assignments"}`}
        </p>

        <div className="flex flex-col gap-3">
          {roles.includes("chairman") && (
            <Link
              to="/chairman"
              className="w-full rounded-xl bg-[#f2f2f4] p-[15px] text-center text-base font-semibold text-[#232329]"
            >
              Open chairman dashboard
            </Link>
          )}
          <Link
            to="/change-password"
            className="w-full rounded-xl border border-[#55555f] bg-transparent p-[15px] text-center text-base font-semibold text-[#f2f2f4]"
          >
            Change password
          </Link>
          <button
            className="w-full rounded-xl bg-[#f2f2f4] p-[15px] text-base font-semibold text-[#232329]"
            onClick={logout}
          >
            Logout
          </button>
          <button
            className="w-full rounded-xl border border-[#7a3b40] bg-transparent p-[15px] text-base font-semibold text-[#ffd9dc]"
            onClick={logoutAll}
          >
            Logout all devices
          </button>
        </div>
      </section>
    </main>
  );
}
