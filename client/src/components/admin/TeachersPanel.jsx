import { useEffect, useState } from "react";

import api, { setAdminAccessToken } from "../../api/client.js";

// Backend list returns id + name/email/phone/status (no createdAt),
// so ObjectId order is used as the joining-date proxy:
// older ObjectId => joined earlier => appears first. Chairman (when known) stays on top.
function sortTeachers(teachers, chairmanId) {
  return [...teachers].sort((a, b) => {
    const aChair = chairmanId && a.id === chairmanId;
    const bChair = chairmanId && b.id === chairmanId;
    if (aChair && !bChair) return -1;
    if (bChair && !aChair) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

function serverError(err, fallback) {
  const details = err.response?.data?.details?.fieldErrors;
  const firstDetail =
    (details && Object.values(details).flat()[0]) || null;
  return firstDetail || err.response?.data?.error || fallback;
}

export default function TeachersPanel() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [chairmanId, setChairmanId] = useState(
    () => sessionStorage.getItem("chairmanTeacherId") || null
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [tRes, cRes] = await Promise.all([
        api.get("/api/admin/teachers", { params: { status: "active" } }),
        api.get("/api/admin/chairmen/current"),
      ]);
      const cid = cRes.data?.data?.teacher?.id || null;
      if (cid) {
        sessionStorage.setItem("chairmanTeacherId", cid);
        setChairmanId(cid);
      }
      let list = tRes.data.teachers || [];
      // Guarantee the chairman is on top even if missing from the active list.
      const chairTeacher = cRes.data?.data?.teacher;
      if (chairTeacher && !list.some((t) => t.id === chairTeacher.id)) {
        list = [chairTeacher, ...list];
      }
      setTeachers(sortTeachers(list, cid));
    } catch (err) {
      setError(serverError(err, "Failed to load teachers"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backend has no hard-delete (deactivate only by design) and no
  // password-verify endpoint — deletion runs only after re-verifying the
  // admin password via VerifyDeleteModal below.
  function handleDeleted(id) {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleCopyEmail(id, email) {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = email;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current));
    }, 1500);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teachers</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-[#f2f2f4] px-4 py-2.5 text-sm font-semibold text-[#232329]"
        >
          Create teacher profile
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#7a3b40] bg-[#4a2b2e] px-3 py-2.5 text-sm text-[#ffd9dc]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[15px] text-[#b9b9c2]">Loading teachers…</p>
      ) : teachers.length === 0 ? (
        <p className="text-[15px] text-[#b9b9c2]">No teachers found.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {teachers.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-[#45454e] bg-[#2e2e35] px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">
                  {t.name}
                  {chairmanId && t.id === chairmanId && (
                    <span className="font-normal text-[#b9b9c2]"> (chairman)</span>
                  )}
                </p>
                <p className="truncate text-sm text-[#b9b9c2]">{t.email}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleCopyEmail(t.id, t.email)}
                  className="rounded-xl border border-[#55555f] bg-transparent px-4 py-2 text-sm font-semibold text-[#f2f2f4]"
                >
                  {copiedId === t.id ? "Copied" : "Copy email"}
                </button>
                <button
                  onClick={() => setPendingDelete({ id: t.id, name: t.name })}
                  className="rounded-xl border border-[#7a3b40] bg-transparent px-4 py-2 text-sm font-semibold text-[#ffd9dc]"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateTeacherModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {pendingDelete && (
        <VerifyDeleteModal
          teacher={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDeleted={handleDeleted}
          onError={setError}
        />
      )}
    </div>
  );
}

function CreateTeacherModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter the teacher's name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (tempPassword.length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/admin/teachers", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        tempPassword,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(serverError(err, "Failed to create teacher"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <section
        aria-label="Create teacher profile"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <h2 className="mb-2 text-2xl font-bold">Create teacher profile</h2>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">The teacher must change this password on first sign in.</p>

        <form onSubmit={onSubmit} noValidate>
          <label className="mb-2 block text-sm font-semibold" htmlFor="t-name">Name</label>
          <input
            id="t-name"
            type="text"
            placeholder="Full name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <label className="mb-2 block text-sm font-semibold" htmlFor="t-email">Email</label>
          <input
            id="t-email"
            type="email"
            placeholder="name@university.edu"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <label className="mb-2 block text-sm font-semibold" htmlFor="t-phone">Phone (optional)</label>
          <input
            id="t-phone"
            type="text"
            placeholder="Phone number"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <label className="mb-2 block text-sm font-semibold" htmlFor="t-pass">Temporary password</label>
          <input
            id="t-pass"
            type="text"
            placeholder="Minimum 8 characters"
            autoComplete="off"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
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
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// Delete requires the admin's own password. The backend exposes no
// verify-only endpoint, so verification re-uses POST /api/admin/login
// (wrong password => 401, same as the login page). On success the fresh
// access token is adopted, then the teacher is deactivated.
function VerifyDeleteModal({ teacher, onClose, onDeleted, onError }) {
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
      await api.patch(`/api/admin/teachers/${teacher.id}/deactivate`);
      onDeleted(teacher.id);
      onClose();
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Incorrect admin password.");
      } else {
        const msg = serverError(err, "Failed to delete teacher");
        setError(msg);
        if (err.config?.url?.includes("/deactivate")) onError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <section
        aria-label="Confirm teacher deletion"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <h2 className="mb-2 text-2xl font-bold">Delete teacher?</h2>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">
          {teacher.name} will be deactivated and signed out everywhere. Enter your admin password to confirm.
        </p>

        <form onSubmit={onSubmit} noValidate>
          {!storedUsername && (
            <>
              <label className="mb-2 block text-sm font-semibold" htmlFor="v-user">Admin username</label>
              <input
                id="v-user"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
              />
            </>
          )}

          <label className="mb-2 block text-sm font-semibold" htmlFor="v-pass">Your password</label>
          <input
            id="v-pass"
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
              className="w-full rounded-xl border border-[#7a3b40] bg-transparent p-[15px] text-base font-semibold text-[#ffd9dc] disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Delete"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
