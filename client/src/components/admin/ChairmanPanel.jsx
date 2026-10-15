import { useEffect, useState } from "react";

import api, { setAdminAccessToken } from "../../api/client.js";

function serverError(err, fallback) {
  const details = err.response?.data?.details?.fieldErrors;
  const firstDetail =
    (details && Object.values(details).flat()[0]) || null;
  return firstDetail || err.response?.data?.error || fallback;
}

export default function ChairmanPanel() {
  const [current, setCurrent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newId, setNewId] = useState("");
  const [showChange, setShowChange] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [cRes, tRes] = await Promise.all([
        api.get("/api/admin/chairmen/current"),
        api.get("/api/admin/teachers", { params: { status: "active" } }),
      ]);
      setCurrent(cRes.data?.data || null);
      setTeachers(tRes.data.teachers || []);
      const cid = cRes.data?.data?.teacher?.id;
      if (cid) sessionStorage.setItem("chairmanTeacherId", cid);
    } catch (err) {
      setError(serverError(err, "Failed to load chairman"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const candidates = teachers.filter((t) => t.id !== current?.teacher?.id);
  const selectedTeacher = teachers.find((t) => t.id === newId);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Chairman</h1>

      {error && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#7a3b40] bg-[#4a2b2e] px-3 py-2.5 text-sm text-[#ffd9dc]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[15px] text-[#b9b9c2]">Loading chairman…</p>
      ) : (
        <>
          <section aria-label="Current chairman" className="mb-6 rounded-2xl border border-[#45454e] bg-[#2e2e35] px-5 py-4">
            <p className="mb-3 text-sm font-semibold text-[#b9b9c2]">Current chairman</p>
            {current ? (
              <>
                <p className="text-[15px] font-semibold">{current.teacher.name}</p>
                <p className="text-sm text-[#b9b9c2]">{current.teacher.email}</p>
                {current.teacher.phone && (
                  <p className="text-sm text-[#b9b9c2]">{current.teacher.phone}</p>
                )}
                {current.startDate && (
                  <p className="mt-1 text-sm text-[#b9b9c2]">
                    In role since {new Date(current.startDate).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[15px] text-[#b9b9c2]">No active chairman.</p>
            )}
          </section>

          <section aria-label="Change chairman" className="rounded-2xl border border-[#45454e] bg-[#2e2e35] px-5 py-4">
            <p className="mb-3 text-sm font-semibold text-[#b9b9c2]">Change chairman</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none focus:border-[#8f8f9a]"
              >
                <option value="">Select new chairman…</option>
                {candidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.email}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowChange(true)}
                disabled={!newId}
                className="shrink-0 rounded-xl bg-[#f2f2f4] px-6 py-[14px] text-[15px] font-semibold text-[#232329] disabled:opacity-60"
              >
                Change
              </button>
            </div>
          </section>
        </>
      )}

      {showChange && selectedTeacher && (
        <ConfirmChangeModal
          teacher={selectedTeacher}
          onClose={() => setShowChange(false)}
          onChanged={() => {
            setNewId("");
            setShowChange(false);
            load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

// Handover runs only after re-verifying the admin password via
// POST /api/admin/login (wrong password => 401), then POST /chairmen/change.
function ConfirmChangeModal({ teacher, onClose, onChanged, onError }) {
  const storedUsername = sessionStorage.getItem("adminUsername") || "";
  const [username, setUsername] = useState(storedUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim()) {
      setError("Enter your admin username.");
      return;
    }
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/api/admin/login", {
        username: username.trim().toLowerCase(),
        password,
      });
      setAdminAccessToken(data.accessToken);
      await api.post("/api/admin/chairmen/change", { newTeacherId: teacher.id });
      sessionStorage.setItem("chairmanTeacherId", teacher.id);
      onChanged();
    } catch (err) {
      if (
        err.response?.status === 401 &&
        err.config?.url?.includes("/api/admin/login")
      ) {
        setError("Incorrect admin password.");
      } else {
        const msg = serverError(err, "Failed to change chairman");
        setError(msg);
        if (err.config?.url?.includes("/chairmen/change")) onError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <section
        aria-label="Confirm chairman change"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <h2 className="mb-2 text-2xl font-bold">Change chairman?</h2>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">
          {teacher.name} ({teacher.email}) will become chairman. Enter your admin password to confirm.
        </p>

        <form onSubmit={onSubmit} noValidate>
          {!storedUsername && (
            <>
              <label className="mb-2 block text-sm font-semibold" htmlFor="c-user">Admin username</label>
              <input
                id="c-user"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
              />
            </>
          )}

          <label className="mb-2 block text-sm font-semibold" htmlFor="c-pass">Your password</label>
          <input
            id="c-pass"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mb-6 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

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
              {busy ? "Verifying…" : "Confirm"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
