import { useEffect, useState } from "react";

import api from "../../api/client.js";

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[#45454e] bg-[#2e2e35] p-5">
      <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-[#b9b9c2]">{hint}</p>
    </div>
  );
}

export default function OverviewPanel({ onNavigate }) {
  const [teachers, setTeachers] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError("");
    (async () => {
      try {
        const res = await api.get("/api/chairman/teachers");
        if (!cancelled) setTeachers(res.data?.teachers || []);
      } catch {
        if (!cancelled) setError("Could not load the teacher overview.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const list = teachers || [];
  const active = list.filter((teacher) => teacher.status === "active").length;
  const inCommittees = list.filter((teacher) => teacher.committeeCount > 0).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Chairman overview</h1>
        <p className="mt-2 text-[15px] text-[#b9b9c2]">
          Teaching staff and examination committee activity at a glance.
        </p>
      </div>

      {error ? (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-[#7a3b40] bg-[#3a2a2c] px-4 py-3 text-sm text-[#ffd9dc]">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="rounded-lg bg-[#ffd9dc] px-3 py-1.5 font-semibold text-[#3a2a2c]"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Teachers"
          value={teachers === null ? "…" : list.length}
          hint="Registered teaching staff"
        />
        <StatCard
          label="Active teachers"
          value={teachers === null ? "…" : active}
          hint="Currently active accounts"
        />
        <StatCard
          label="In committees"
          value={teachers === null ? "…" : inCommittees}
          hint="Teachers with active committee roles"
        />
      </div>

      <section className="mt-6 rounded-2xl border border-[#45454e] bg-[#2e2e35] p-6">
        <h2 className="text-lg font-bold">View all teachers</h2>
        <p className="mt-1 text-[15px] text-[#b9b9c2]">
          Inspect each teacher&apos;s course assignments and examination committee memberships.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("teachers")}
          className="mt-4 rounded-xl bg-[#f2f2f4] px-5 py-3 text-sm font-semibold text-[#232329]"
        >
          View all teachers
        </button>
      </section>
    </div>
  );
}
