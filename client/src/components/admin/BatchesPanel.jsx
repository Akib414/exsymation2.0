import { useEffect, useState } from "react";

import api from "../../api/client.js";

function serverError(err, fallback) {
  const details = err.response?.data?.details?.fieldErrors;
  const firstDetail =
    (details && Object.values(details).flat()[0]) || null;
  return firstDetail || err.response?.data?.error || fallback;
}

export default function BatchesPanel() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/admin/batches");
      setBatches(data.batches || []);
    } catch (err) {
      setError(serverError(err, "Failed to load batches"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Batches</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-[#f2f2f4] px-4 py-2.5 text-sm font-semibold text-[#232329]"
        >
          Create batch
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#7a3b40] bg-[#4a2b2e] px-3 py-2.5 text-sm text-[#ffd9dc]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[15px] text-[#b9b9c2]">Loading batches…</p>
      ) : batches.length === 0 ? (
        <p className="text-[15px] text-[#b9b9c2]">No batches found.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#45454e]">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-[#45454e] bg-[#2e2e35] text-sm text-[#b9b9c2]">
                <th className="px-5 py-3 font-semibold">SESSION</th>
                <th className="px-5 py-3 font-semibold">BATCH</th>
                <th className="px-5 py-3 font-semibold">CURRENT SEMESTER</th>
                <th className="px-5 py-3 font-semibold">STUDENTS</th>
                <th className="px-5 py-3 font-semibold">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-[#45454e] last:border-0">
                  <td className="px-5 py-3 font-semibold">{b.session}</td>
                  <td className="px-5 py-3">{b.batch}</td>
                  <td className="px-5 py-3 text-[#b9b9c2]">{b.current_semester}</td>
                  <td className="px-5 py-3">{b.student_number}</td>
                  <td className="px-5 py-3 text-[#b9b9c2]">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateBatchModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
          onError={setError}
        />
      )}
    </div>
  );
}

// POST /api/admin/batches — all backend fields:
// session*, batch*, student_number*, current_semester (1-10, default 1), status (default active).
function CreateBatchModal({ onClose, onCreated, onError }) {
  const [session, setSession] = useState("");
  const [batch, setBatch] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [currentSemester, setCurrentSemester] = useState(1);
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!session.trim()) {
      setError("Enter the session.");
      return;
    }
    if (!batch.trim()) {
      setError("Enter the batch.");
      return;
    }
    const num = Number(studentNumber);
    if (!Number.isInteger(num) || num < 0) {
      setError("Student number must be a whole number of 0 or more.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/admin/batches", {
        session: session.trim(),
        batch: batch.trim(),
        student_number: num,
        current_semester: Number(currentSemester),
        status,
      });
      onCreated();
      onClose();
    } catch (err) {
      const msg = serverError(err, "Failed to create batch");
      setError(msg);
      if (err.response?.status === 409) onError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <section
        aria-label="Create batch"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <h2 className="mb-2 text-2xl font-bold">Create batch</h2>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">Adds a new session batch.</p>

        <form onSubmit={onSubmit} noValidate>
          <label className="mb-2 block text-sm font-semibold" htmlFor="b-session">Session</label>
          <input
            id="b-session"
            type="text"
            placeholder="2023-24"
            autoComplete="off"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <label className="mb-2 block text-sm font-semibold" htmlFor="b-batch">Batch</label>
          <input
            id="b-batch"
            type="text"
            placeholder="52"
            autoComplete="off"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <label className="mb-2 block text-sm font-semibold" htmlFor="b-num">Number of students</label>
          <input
            id="b-num"
            type="number"
            min="0"
            step="1"
            placeholder="60"
            value={studentNumber}
            onChange={(e) => setStudentNumber(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <div className="flex gap-3">
            <div className="w-full">
              <label className="mb-2 block text-sm font-semibold" htmlFor="b-sem">Current semester</label>
              <select
                id="b-sem"
                value={currentSemester}
                onChange={(e) => setCurrentSemester(e.target.value)}
                className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none focus:border-[#8f8f9a]"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="mb-2 block text-sm font-semibold" htmlFor="b-status">Status</label>
              <select
                id="b-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none focus:border-[#8f8f9a]"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-[10px] border border-[#7a3b40] bg-[#4a2b2e] px-3 py-2.5 text-sm text-[#ffd9dc]">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-[#55555f] bg-transparent p-[15px] text-base font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#f2f2f4] p-[15px] text-base font-semibold text-[#232329] disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
