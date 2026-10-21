import { useEffect, useState } from "react";

import api from "../../api/client.js";
import {
  Badge,
  EmptyNote,
  ErrorBanner,
  formatDate,
  serverError,
  statusTone,
} from "./ui.jsx";

function StatCard({ label, value, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-[#45454e] bg-[#2e2e35] px-5 py-4 text-left"
    >
      <p className="text-sm text-[#b9b9c2]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-xs text-[#8f8f9a]">{hint}</p>
    </button>
  );
}

export default function OverviewPanel({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [teachersRes, batchesRes, committeesRes] = await Promise.all([
          api.get("/api/chairman/teachers"),
          api.get("/api/chairman/batches"),
          api.get("/api/committees", { params: { status: "active" } }),
        ]);
        if (cancelled) return;
        setData({
          teachers: teachersRes.data?.teachers || [],
          batches: batchesRes.data?.batches || [],
          committees: committeesRes.data?.data || [],
        });
      } catch (err) {
        if (!cancelled) setError(serverError(err, "Failed to load chairman overview"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorBanner>{error}</ErrorBanner>;
  if (!data) return <EmptyNote>Loading overview…</EmptyNote>;

  const activeTeachers = data.teachers.filter((row) => row.status === "active").length;
  const activeBatches = data.batches.filter((row) => row.status === "active").length;
  const activeCommittees = data.committees.filter((row) => row.status === "active");
  const runningBatches = data.batches.filter((row) => row.status === "active").slice(0, 5);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Chairman overview</h1>
        <p className="mt-1 text-[15px] text-[#b9b9c2]">
          Monitor teachers, running batches, and examination committees from one place.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Teachers"
          value={activeTeachers}
          hint={`active / ${data.teachers.length} total`}
          onClick={() => onNavigate("teachers")}
        />
        <StatCard
          label="Batches"
          value={activeBatches}
          hint={`active / ${data.batches.length} total`}
          onClick={() => onNavigate("batches")}
        />
        <StatCard
          label="Active committees"
          value={activeCommittees.length}
          hint="within the current term"
          onClick={() => onNavigate("committees")}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#45454e] bg-[#2e2e35] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#b9b9c2]">
              Active committees
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("committees")}
              className="text-sm font-semibold underline underline-offset-4"
            >
              View all
            </button>
          </div>
          {activeCommittees.length === 0 ? (
            <EmptyNote>No active committees right now.</EmptyNote>
          ) : (
            <ul className="flex flex-col gap-2">
              {activeCommittees.slice(0, 5).map((committee) => (
                <li
                  key={committee._id}
                  className="rounded-xl border border-[#3a3a43] bg-[#34333c] px-4 py-3"
                >
                  <p className="text-sm font-semibold">
                    {committee.session?.session || "Session"} ·{" "}
                    {committee.session?.batch || "Batch"} · Semester {committee.semester}
                  </p>
                  <p className="text-sm text-[#b9b9c2]">
                    Chairman: {committee.chairman?.name || "—"}
                  </p>
                  <p className="text-xs text-[#8f8f9a]">
                    {formatDate(committee.start)} – {formatDate(committee.end)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#45454e] bg-[#2e2e35] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#b9b9c2]">
              Running batches
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("batches")}
              className="text-sm font-semibold underline underline-offset-4"
            >
              View all
            </button>
          </div>
          {runningBatches.length === 0 ? (
            <EmptyNote>No running batches.</EmptyNote>
          ) : (
            <ul className="flex flex-col gap-2">
              {runningBatches.map((batch) => (
                <li
                  key={batch.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#3a3a43] bg-[#34333c] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {batch.session} · {batch.batch}
                    </p>
                    <p className="text-xs text-[#8f8f9a]">
                      Semester {batch.current_semester} · {batch.student_number} students
                    </p>
                  </div>
                  <Badge tone={statusTone(batch.status)}>{batch.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
