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

export default function OverviewPanel() {
  const [teachers, setTeachers] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [runningCommittees, setRunningCommittees] = useState(null);
  const [upcomingExams, setUpcomingExams] = useState(null);
  const [runningBatches, setRunningBatches] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError("");
    (async () => {
      try {
        const [teacherRes, committeeRes, batchRes] = await Promise.all([
          api.get("/api/chairman/teachers"),
          api.get("/api/chairman/committees", { params: { state: "running" } }),
          api.get("/api/chairman/batches"),
        ]);
        if (!cancelled) {
          setTeachers(teacherRes.data?.teachers || []);
          setRunningCommittees(committeeRes.data?.count ?? 0);
          setUpcomingExams(committeeRes.data?.upcomingExamTotal ?? 0);
          setRunningBatches(
            (batchRes.data?.batches || []).filter((batch) => batch.status === "active").length
          );
        }
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <StatCard
          label="Running committees"
          value={runningCommittees === null ? "…" : runningCommittees}
          hint="Active inside their date window"
        />
        <StatCard
          label="Running batches"
          value={runningBatches === null ? "…" : runningBatches}
          hint="Batches with an active status"
        />
        <StatCard
          label="Upcoming examinations"
          value={upcomingExams === null ? "…" : upcomingExams}
          hint="Examination routines still to come"
        />
      </div>
    </div>
  );
}
