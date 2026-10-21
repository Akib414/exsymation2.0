import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../../api/client.js";
import CommitteeDetailDrawer from "./CommitteeDetailDrawer.jsx";
import CreateCommitteeModal from "./CreateCommitteeModal.jsx";

const STATE_FILTERS = [
  { value: "running", label: "Running" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "inactive", label: "Inactive" },
  { value: "", label: "All committees" },
];

const STATE_LABELS = {
  running: "Running",
  scheduled: "Scheduled",
  completed: "Completed",
  inactive: "Inactive",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StateBadge({ state }) {
  const tones = {
    running: "bg-[#233d2b] text-[#9fe0b0]",
    scheduled: "bg-[#2f3348] text-[#b3c0f5]",
    completed: "bg-[#3a3326] text-[#e7c98a]",
    inactive: "bg-[#3a2a2c] text-[#f0b3b9]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        tones[state] || "bg-[#34333c] text-[#d7d7dd]"
      }`}
    >
      {STATE_LABELS[state] || state}
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

export default function CommitteesPanel() {
  const [state, setState] = useState("running");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [committees, setCommittees] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/chairman/committees", {
        params: { state: state || undefined, q: query || undefined },
        signal,
      });
      setCommittees(res.data?.committees || []);
      setTotal(res.data?.total ?? (res.data?.committees || []).length);
    } catch (err) {
      if (err.code !== "ERR_CANCELED") {
        setError("Could not load examination committees. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [state, query]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, attempt]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const stats = useMemo(() => {
    const exams = committees.reduce((totalExams, committee) => totalExams + (committee.upcomingExamCount || 0), 0);
    return { exams };
  }, [committees]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Exam committees</h1>
          <p className="mt-2 text-[15px] text-[#b9b9c2]">
            Review committee composition, running status, and upcoming examinations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-xl bg-[#f2f2f4] px-5 py-3 text-sm font-semibold text-[#232329]"
        >
          + Create New Committee
        </button>
      </div>

      {notice ? (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-[#3f6b4a] bg-[#233d2b] px-4 py-3 text-sm text-[#9fe0b0]">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="rounded-lg bg-[#9fe0b0] px-3 py-1.5 font-semibold text-[#233d2b]"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <SummaryChip value={committees.length} singular="committee" plural="committees" />
        <SummaryChip value={stats.exams} singular="upcoming examination" plural="upcoming examinations" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="committee-search" className="sr-only">
            Search committees
          </label>
          <input
            id="committee-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search batch, session, or teacher"
            className="w-full rounded-xl border border-[#55555f] bg-[#2e2e35] px-4 py-3 text-[15px] text-[#f2f2f4] placeholder:text-[#8f8f9b]"
          />
        </div>
        <div>
          <label htmlFor="committee-state" className="sr-only">
            Filter by committee status
          </label>
          <select
            id="committee-state"
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="w-full rounded-xl border border-[#55555f] bg-[#2e2e35] px-4 py-3 text-[15px] text-[#f2f2f4] sm:w-48"
          >
            {STATE_FILTERS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
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
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#34333c] text-xs uppercase tracking-wide text-[#b9b9c2]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Committee</th>
                <th scope="col" className="px-4 py-3 font-semibold">Batch</th>
                <th scope="col" className="px-4 py-3 font-semibold">Chairman</th>
                <th scope="col" className="px-4 py-3 font-semibold">Members</th>
                <th scope="col" className="px-4 py-3 font-semibold">Start date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#b9b9c2]">
                    Loading committees…
                  </td>
                </tr>
              ) : committees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#b9b9c2]">
                    No examination committees match your search and filters.
                  </td>
                </tr>
              ) : (
                committees.map((committee) => {
                  const members = committee.members || [];
                  const extra = members.filter(
                    (member) =>
                      !["Committee chairman", "Member 1", "Member 2"].includes(member.role)
                  );
                  return (
                    <tr key={committee.id} className="border-t border-[#45454e] align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold">{committee.identifier}</p>
                        <p className="text-xs text-[#b9b9c2]">{committee.academicSession}</p>
                      </td>
                      <td className="px-4 py-4 text-[#b9b9c2]">{committee.batch}</td>
                      <td className="px-4 py-4">{committee.chairman?.name || "—"}</td>
                      <td className="px-4 py-4">
                        <p className="text-[#d7d7dd]">
                          {countLabel(members.length, "member", "members")}
                        </p>
                        {extra.length > 0 ? (
                          <p className="mt-1 text-xs text-[#8f8f9b]">
                            {extra.map((member) => member.name).join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-[#b9b9c2]">{formatDate(committee.start)}</td>
                      <td className="px-4 py-4">
                        <StateBadge state={committee.state} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(committee)}
                          className="rounded-xl border border-[#55555f] px-3 py-2 text-sm font-semibold text-[#f2f2f4]"
                        >
                          + View details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#45454e] px-4 py-3 text-sm text-[#b9b9c2]">
          Showing {committees.length} of {total} committees
        </div>
      </section>

      <p className="mt-3 text-xs text-[#8f8f9b]">
        Committee names are derived from the batch and semester because the committee record does
        not store a separate name. Department and designation are not part of the teacher record.
      </p>

      {selected ? (
        <CommitteeDetailDrawer committee={selected} onClose={() => setSelected(null)} />
      ) : null}

      {creating ? (
        <CreateCommitteeModal
          onClose={() => setCreating(false)}
          onCreated={async (created) => {
            setCreating(false);
            setNotice(
              `Committee ${created?.identifier || "created"} was created successfully.`
            );
            setAttempt((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}
