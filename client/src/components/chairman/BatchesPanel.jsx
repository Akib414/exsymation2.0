import { useEffect, useMemo, useState } from "react";

import api from "../../api/client.js";
import BatchDetailDrawer from "./BatchDetailDrawer.jsx";

function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        active ? "bg-[#233d2b] text-[#9fe0b0]" : "bg-[#3a2a2c] text-[#f0b3b9]"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function SummaryChip({ value, singular, plural }) {
  return (
    <span className="rounded-full border border-[#45454e] bg-[#34333c] px-3 py-1 text-xs text-[#d7d7dd]">
      {countLabel(value, singular, plural)}
    </span>
  );
}

export default function BatchesPanel() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/api/chairman/batches", { signal: controller.signal });
        if (!cancelled) setBatches(res.data?.batches || []);
      } catch (err) {
        if (!cancelled && err.code !== "ERR_CANCELED") {
          setError("Could not load batches. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt]);

  const stats = useMemo(() => {
    const running = batches.filter((batch) => batch.status === "active");
    const students = running.reduce((total, batch) => total + (batch.student_number || 0), 0);
    return { running: running.length, students };
  }, [batches]);

  const needle = search.trim().toLowerCase();
  const visible = batches.filter((batch) => {
    if (status && batch.status !== status) return false;
    if (!needle) return true;
    return `${batch.session} ${batch.batch}`.toLowerCase().includes(needle);
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Batches</h1>
        <p className="mt-2 text-[15px] text-[#b9b9c2]">
          Monitor running batches, their course allocations, and academic progress.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <SummaryChip value={stats.running} singular="running batch" plural="running batches" />
        <SummaryChip value={stats.students} singular="recorded student" plural="recorded students" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="batch-search" className="sr-only">
            Search batches
          </label>
          <input
            id="batch-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search session or batch"
            className="w-full rounded-xl border border-[#55555f] bg-[#2e2e35] px-4 py-3 text-[15px] text-[#f2f2f4] placeholder:text-[#8f8f9b]"
          />
        </div>
        <div>
          <label htmlFor="batch-status" className="sr-only">
            Filter by batch status
          </label>
          <select
            id="batch-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-[#55555f] bg-[#2e2e35] px-4 py-3 text-[15px] text-[#f2f2f4] sm:w-52"
          >
            <option value="active">Running (active)</option>
            <option value="inactive">Inactive / completed</option>
            <option value="">All batches</option>
          </select>
        </div>
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

      <section
        className="overflow-hidden rounded-2xl border border-[#45454e] bg-[#2e2e35]"
        aria-busy={loading}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-[#34333c] text-xs uppercase tracking-wide text-[#b9b9c2]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Batch</th>
                <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                <th scope="col" className="px-4 py-3 font-semibold">Current semester</th>
                <th scope="col" className="px-4 py-3 font-semibold">Students</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#b9b9c2]">
                    Loading batches…
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#b9b9c2]">
                    No batches match your search and filters.
                  </td>
                </tr>
              ) : (
                visible.map((batch) => (
                  <tr key={batch.id} className="border-t border-[#45454e] align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold">{batch.batch}</p>
                      <p className="text-xs text-[#b9b9c2]">{batch.session}</p>
                    </td>
                    <td className="px-4 py-4 text-[#b9b9c2]">Not recorded</td>
                    <td className="px-4 py-4 text-[#b9b9c2]">Semester {batch.current_semester}</td>
                    <td className="px-4 py-4">{batch.student_number}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={batch.status} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(batch)}
                        className="rounded-xl border border-[#55555f] px-3 py-2 text-sm font-semibold text-[#f2f2f4]"
                      >
                        + View details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#45454e] px-4 py-3 text-sm text-[#b9b9c2]">
          Showing {visible.length} of {batches.length}{" "}
          {batches.length === 1 ? "batch" : "batches"}
        </div>
      </section>

      <p className="mt-3 text-xs text-[#8f8f9b]">
        Running batches are shown by default. Department and program are not stored in the current
        batch records; student figures are the recorded batch enrollment.
      </p>

      {selected ? (
        <BatchDetailDrawer batch={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
