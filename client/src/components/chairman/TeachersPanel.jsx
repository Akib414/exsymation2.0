import { useEffect, useMemo, useState } from "react";

import api from "../../api/client.js";
import TeacherDetailDrawer from "./TeacherDetailDrawer.jsx";

const PAGE_SIZE = 10;

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

export default function TeachersPanel() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/api/chairman/teachers", {
          params: {
            q: search.trim() || undefined,
            status: status || undefined,
          },
          signal: controller.signal,
        });
        if (!cancelled) {
          setTeachers(res.data?.teachers || []);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled && err.code !== "ERR_CANCELED") {
          setError("Could not load teachers. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, attempt]);

  const stats = useMemo(() => {
    const active = teachers.filter((teacher) => teacher.status === "active").length;
    const inCommittees = teachers.filter((teacher) => teacher.committeeCount > 0).length;
    return { active, inCommittees };
  }, [teachers]);

  const totalPages = Math.max(1, Math.ceil(teachers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visible = teachers.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = teachers.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, teachers.length);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Teachers</h1>
        <p className="mt-2 text-[15px] text-[#b9b9c2]">
          Review teaching staff, their course assignments, and examination committee roles.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <SummaryChip value={teachers.length} singular="teacher" plural="teachers" />
        <SummaryChip value={stats.active} singular="active teacher" plural="active teachers" />
        <SummaryChip value={stats.inCommittees} singular="in committee" plural="in committees" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="teacher-search" className="sr-only">
            Search teachers
          </label>
          <input
            id="teacher-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-xl border border-[#55555f] bg-[#2e2e35] px-4 py-3 text-[15px] text-[#f2f2f4] placeholder:text-[#8f8f9b]"
          />
        </div>
        <div>
          <label htmlFor="teacher-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="teacher-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-[#55555f] bg-[#2e2e35] px-4 py-3 text-[15px] text-[#f2f2f4] sm:w-48"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#34333c] text-xs uppercase tracking-wide text-[#b9b9c2]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Teacher</th>
                <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                <th scope="col" className="px-4 py-3 font-semibold">Current responsibilities</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#b9b9c2]">
                    Loading teachers…
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#b9b9c2]">
                    No teachers match your search and filters.
                  </td>
                </tr>
              ) : (
                visible.map((teacher) => (
                  <tr key={teacher.id} className="border-t border-[#45454e] align-top">
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{teacher.name}</span>
                        {teacher.isChairman ? (
                          <span className="rounded-full bg-[#34333c] px-2 py-0.5 text-xs font-semibold text-[#d7d7dd]">
                            Chairman
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[#b9b9c2]">Not recorded</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2 text-xs text-[#d7d7dd]">
                        <span>
                          {countLabel(teacher.assignmentCount, "course assignment", "course assignments")}
                        </span>
                        <span>{countLabel(teacher.committeeCount, "committee", "committees")}</span>
                        {teacher.invigilationCount > 0 ? (
                          <span>
                            {countLabel(teacher.invigilationCount, "invigilation duty", "invigilation duties")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={teacher.status} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(teacher)}
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#45454e] px-4 py-3 text-sm text-[#b9b9c2]">
          <span>
            Showing {rangeStart}–{rangeEnd} of {teachers.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={safePage <= 1 || loading}
              className="rounded-lg border border-[#55555f] px-3 py-1.5 font-semibold text-[#f2f2f4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={safePage >= totalPages || loading}
              className="rounded-lg border border-[#55555f] px-3 py-1.5 font-semibold text-[#f2f2f4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <p className="mt-3 text-xs text-[#8f8f9b]">
        Department, designation, and employee ID are not stored in the current teacher records.
        Personal contact details are intentionally hidden.
      </p>

      {selected ? (
        <TeacherDetailDrawer teacher={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
