import { useEffect, useMemo, useState } from "react";

import api from "../../api/client.js";

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const ROLES = [
  { key: "chairman", label: "Committee chairman" },
  { key: "member1", label: "Committee member 1" },
  { key: "member2", label: "Committee member 2" },
];

const inputClass =
  "w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-3 text-[15px] text-[#f2f2f4] placeholder:text-[#8f8f9b]";

function toIso(value, endOfDay) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function CreateCommitteeModal({ onClose, onCreated }) {
  const [batches, setBatches] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [unavailable, setUnavailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [batchId, setBatchId] = useState("");
  const [semester, setSemester] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roles, setRoles] = useState({ chairman: "", member1: "", member2: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [batchRes, committeeRes, teacherRes] = await Promise.all([
          api.get("/api/chairman/batches"),
          api.get("/api/chairman/committees"),
          api.get("/api/chairman/committees/eligible-teachers"),
        ]);
        if (cancelled) return;
        const list = batchRes.data?.batches || [];
        setBatches(list);
        setCommittees(committeeRes.data?.committees || []);
        setEligible(teacherRes.data?.eligible || []);
        setUnavailable(teacherRes.data?.unavailable || []);
        if (list.length > 0) {
          setBatchId(list[0].id);
          setSemester(String(list[0].current_semester || 1));
        }
      } catch {
        if (!cancelled) setLoadError("Could not load the form data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose, submitting]);

  const batch = useMemo(
    () => batches.find((item) => item.id === batchId) || null,
    [batches, batchId]
  );

  const identifier = batch ? `${batch.batch} · Semester ${semester}` : "Select a batch";

  const teacherOptions = useMemo(() => {
    const options = [
      ...eligible.map((teacher) => ({ ...teacher, unavailable: false })),
      ...unavailable.map((teacher) => ({ ...teacher, unavailable: true })),
    ];
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [eligible, unavailable]);

  function optionsFor(roleKey) {
    return teacherOptions.map((teacher) => {
      const takenElsewhere = ROLES.some(
        (role) => role.key !== roleKey && roles[role.key] && roles[role.key] === teacher.id
      );
      const disabled = teacher.unavailable || takenElsewhere;
      const label = teacher.unavailable
        ? `${teacher.name} — unavailable (${teacher.committee?.identifier || "in a committee"})`
        : takenElsewhere
          ? `${teacher.name} — already selected for another role`
          : teacher.name;
      return { value: teacher.id, label, disabled };
    });
  }

  function onBatchChange(value) {
    setBatchId(value);
    const selected = batches.find((item) => item.id === value);
    if (selected) setSemester(String(selected.current_semester || 1));
  }

  const selectedIds = ROLES.map((role) => roles[role.key]).filter(Boolean);
  const distinct = new Set(selectedIds).size === selectedIds.length;
  const allAssigned = ROLES.every((role) => roles[role.key]);
  const startIso = toIso(startDate, false);
  const endIso = toIso(endDate, true);
  const effectiveEnd = endIso || new Date(new Date(startIso || Date.now()).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const datesValid = !!startIso && (!endIso || new Date(endIso) > new Date(startIso));

  const overlapping = useMemo(() => {
    if (!batchId || !startIso) return null;
    return (
      committees.find(
        (committee) =>
          committee.sessionId === batchId &&
          committee.semester === Number(semester) &&
          committee.status === "active" &&
          new Date(committee.start) <= new Date(effectiveEnd) &&
          new Date(committee.end) >= new Date(startIso)
      ) || null
    );
  }, [committees, batchId, semester, startIso, effectiveEnd]);

  const canSubmit =
    !loading && !submitting && !!batchId && !!startIso && allAssigned && distinct && datesValid && !overlapping;

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/api/chairman/committees", {
        chairman: roles.chairman,
        member1: roles.member1,
        member2: roles.member2,
        session: batchId,
        semester: Number(semester),
        start: startIso,
        end: endIso || undefined,
      });
      onCreated(res.data?.data || null);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not create the committee. Check the assignments and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close create committee form"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-committee-title"
        className="relative flex max-h-[92vh] w-full max-w-[620px] flex-col overflow-y-auto rounded-2xl border border-[#45454e] bg-[#2e2e35] text-[#f2f2f4] shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <header className="border-b border-[#45454e] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">New committee</p>
              <h2 id="create-committee-title" className="mt-1 text-2xl font-bold">
                Create examination committee
              </h2>
              <p className="mt-1 text-sm text-[#b9b9c2]">
                One chairman, two members, and no teacher who is already serving a committee.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="shrink-0 rounded-xl border border-[#55555f] px-4 py-2 text-sm font-semibold text-[#f2f2f4] disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 px-6 py-6">
          {loadError ? (
            <div className="rounded-xl border border-[#7a3b40] bg-[#3a2a2c] px-4 py-3 text-sm text-[#ffd9dc]">
              {loadError}
            </div>
          ) : null}

          <div className="rounded-xl border border-[#45454e] bg-[#34333c] px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">Committee identifier</p>
            <p className="mt-1 font-semibold">{loading ? "Loading…" : identifier}</p>
            <p className="mt-1 text-xs text-[#8f8f9b]">
              The committee record stores no separate name, so the identifier is derived from the
              batch and semester.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cc-batch" className="mb-2 block text-sm font-semibold">
                Associated batch
              </label>
              <select
                id="cc-batch"
                value={batchId}
                onChange={(event) => onBatchChange(event.target.value)}
                disabled={loading || submitting}
                className={inputClass}
              >
                {batches.length === 0 ? <option value="">No batches available</option> : null}
                {batches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.batch} · {item.session}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cc-semester" className="mb-2 block text-sm font-semibold">
                Academic semester
              </label>
              <select
                id="cc-semester"
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                disabled={loading || submitting}
                className={inputClass}
              >
                {SEMESTERS.map((value) => (
                  <option key={value} value={value}>
                    Semester {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cc-start" className="mb-2 block text-sm font-semibold">
                Formation date
              </label>
              <input
                id="cc-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                disabled={submitting}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="cc-end" className="mb-2 block text-sm font-semibold">
                End date <span className="text-xs text-[#8f8f9b]">(optional)</span>
              </label>
              <input
                id="cc-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                disabled={submitting}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {ROLES.map((role) => (
              <div key={role.key}>
                <label htmlFor={`cc-${role.key}`} className="mb-2 block text-sm font-semibold">
                  {role.label}
                </label>
                <select
                  id={`cc-${role.key}`}
                  value={roles[role.key]}
                  onChange={(event) =>
                    setRoles((current) => ({ ...current, [role.key]: event.target.value }))
                  }
                  disabled={loading || submitting}
                  className={inputClass}
                >
                  <option value="">Select a teacher</option>
                  {optionsFor(role.key).map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {selectedIds.length > 0 && !distinct ? (
            <p className="text-sm text-[#ffd9dc]">
              The chairman and the two members must be three different teachers.
            </p>
          ) : null}

          {startDate && !datesValid ? (
            <p className="text-sm text-[#ffd9dc]">
              The formation date must be before the end date.
            </p>
          ) : null}

          {overlapping ? (
            <p className="text-sm text-[#ffd9dc]">
              An active committee already covers {batch?.batch} · Semester {semester} for these
              dates. Choose a different semester or date range.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl border border-[#7a3b40] bg-[#3a2a2c] px-4 py-3 text-sm text-[#ffd9dc]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-[#55555f] px-5 py-3 text-sm font-semibold text-[#f2f2f4] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-[#f2f2f4] px-5 py-3 text-sm font-semibold text-[#232329] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create committee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
