import { useEffect, useState } from "react";

import api from "../../api/client.js";

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function ordinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function serverError(err, fallback) {
  const details = err.response?.data?.details?.fieldErrors;
  const firstDetail =
    (details && Object.values(details).flat()[0]) || null;
  return firstDetail || err.response?.data?.error || fallback;
}

export default function CoursesPanel() {
  const [semester, setSemester] = useState(1);
  const [semesterMap, setSemesterMap] = useState({});
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addId, setAddId] = useState("");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  // One course lives in exactly one semester: load every semester once so the
  // dropdown can hide/disable courses already attached elsewhere (backend 409s as backup).
  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [aRes, ...sRes] = await Promise.all([
        api.get("/api/admin/courses"),
        ...SEMESTERS.map((s) => api.get(`/api/admin/semester-courses/${s}`)),
      ]);
      setAllCourses(aRes.data.courses || []);
      const map = {};
      sRes.forEach((r, i) => {
        map[SEMESTERS[i]] = r.data.courses || [];
      });
      setSemesterMap(map);
      setAddId("");
    } catch (err) {
      setError(serverError(err, "Failed to load courses"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courses = semesterMap[semester] || [];
  const sortedCourses = [...courses].sort((a, b) =>
    String(a.course_code).localeCompare(String(b.course_code), undefined, {
      numeric: true,
    })
  );

  const totalCredits = courses.reduce(
    (sum, c) => sum + (Number(c.course_credit) || 0),
    0
  );
  // Course -> semester lookup for the one-course-one-semester rule.
  const assignedTo = {};
  Object.entries(semesterMap).forEach(([sem, list]) => {
    list.forEach((c) => {
      assignedTo[c.id] = Number(sem);
    });
  });
  const q = query.trim().toLowerCase();
  // Search covers only courses not yet attached to any semester.
  const addable = allCourses.filter((c) => !(c.id in assignedTo));
  const matches = addable
    .filter(
      (c) =>
        !q ||
        c.course_code.toLowerCase().includes(q) ||
        c.course_name.toLowerCase().includes(q)
    )
    .sort((a, b) =>
      String(a.course_code).localeCompare(String(b.course_code), undefined, {
        numeric: true,
      })
    );

  function pickCourse(c) {
    if (c.id in assignedTo && assignedTo[c.id] !== semester) return;
    setAddId(c.id);
    setQuery(`${c.course_code} — ${c.course_name}`);
    setPickerOpen(false);
  }

  async function handleAdd() {
    if (!addId) return;
    setAdding(true);
    setError("");
    try {
      const { data } = await api.post("/api/admin/semester-courses/courses", {
        semester,
        courseId: addId,
      });
      setSemesterMap((prev) => ({ ...prev, [semester]: data.courses || [] }));
      setAddId("");
      setQuery("");
    } catch (err) {
      setError(serverError(err, "Failed to add course"));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(courseId) {
    setRemovingId(courseId);
    setError("");
    try {
      const { data } = await api.delete(
        `/api/admin/semester-courses/${semester}/courses/${courseId}`
      );
      setSemesterMap((prev) => ({ ...prev, [semester]: data.courses || [] }));
    } catch (err) {
      setError(serverError(err, "Failed to remove course"));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Courses</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {SEMESTERS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setSemester(s);
              setAddId("");
              setQuery("");
              setPickerOpen(false);
            }}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              semester === s
                ? "border-[#7c3aed] bg-[#7c3aed] text-white"
                : "border-[#55555f] bg-transparent text-[#b9b9c2]"
            }`}
          >
            {ordinal(s)} Semester
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#7a3b40] bg-[#4a2b2e] px-3 py-2.5 text-sm text-[#ffd9dc]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[15px] text-[#b9b9c2]">Loading courses…</p>
      ) : (
        <>
          <p className="mb-3 text-[15px] text-[#b9b9c2]">
            {courses.length} {courses.length === 1 ? "course" : "courses"} · {totalCredits} credits in {ordinal(semester)} Semester
          </p>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full">
              <input
                type="text"
                value={query}
                placeholder="Search by course code or title…"
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setAddId("");
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => setPickerOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setPickerOpen(false);
                }}
                className="w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[12px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
              />
              {pickerOpen && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[#55555f] bg-[#34333c] py-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                  {matches.length === 0 ? (
                    <li className="px-4 py-2.5 text-sm text-[#b9b9c2]">No matching courses.</li>
                  ) : (
                    matches.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickCourse(c)}
                          className="block w-full px-4 py-2.5 text-left text-sm text-[#f2f2f4] hover:bg-[#45454e]"
                        >
                          <span className="font-semibold">{c.course_code}</span>
                          <span className="text-[#b9b9c2]"> — {c.course_name}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <button
              onClick={handleAdd}
              disabled={!addId || adding}
              className="shrink-0 rounded-xl bg-[#f2f2f4] px-6 py-[12px] text-[15px] font-semibold text-[#232329] disabled:opacity-60"
            >
              {adding ? "Adding…" : "Add"}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="shrink-0 rounded-xl border border-[#55555f] bg-transparent px-6 py-[12px] text-[15px] font-semibold text-[#f2f2f4]"
            >
              New course
            </button>
          </div>

          {courses.length === 0 ? (
            <p className="text-[15px] text-[#b9b9c2]">No courses in this semester yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#45454e]">
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="border-b border-[#45454e] bg-[#2e2e35] text-sm text-[#b9b9c2]">
                    <th className="px-5 py-3 font-semibold">CODE</th>
                    <th className="px-5 py-3 font-semibold">NAME</th>
                    <th className="px-5 py-3 font-semibold">TYPE</th>
                    <th className="px-5 py-3 font-semibold">CREDIT</th>
                    <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCourses.map((c) => (
                    <tr key={c.id} className="border-b border-[#45454e] last:border-0">
                      <td className="px-5 py-3 font-semibold text-[#a78bfa]">{c.course_code}</td>
                      <td className="px-5 py-3">{c.course_name}</td>
                      <td className="px-5 py-3 text-[#b9b9c2]">{c.course_type}</td>
                      <td className="px-5 py-3">{c.course_credit}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleRemove(c.id)}
                          disabled={removingId === c.id}
                          className="rounded-xl border border-[#55555f] bg-transparent px-4 py-1.5 text-sm font-semibold text-[#ff9aa0] disabled:opacity-60"
                        >
                          {removingId === c.id ? "Removing…" : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showCreate && (
            <CreateCourseModal
              semester={semester}
              onClose={() => setShowCreate(false)}
              onDone={() => {
                setShowCreate(false);
                loadAll();
              }}
              onError={setError}
            />
          )}
        </>
      )}
    </div>
  );
}

// Creates a brand-new course (POST /api/admin/courses), optionally
// attaching it to the currently selected semester afterwards.
function CreateCourseModal({ semester, onClose, onDone, onError }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Theory");
  const [credit, setCredit] = useState("");
  const [addToSemester, setAddToSemester] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Enter the course code.");
      return;
    }
    if (!title.trim()) {
      setError("Enter the course title.");
      return;
    }
    const creditNum = Number(credit);
    if (!Number.isFinite(creditNum) || creditNum < 0 || creditNum > 10) {
      setError("Credit must be a number between 0 and 10.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/api/admin/courses", {
        course_code: code.trim(),
        course_name: title.trim(),
        course_type: type,
        course_credit: creditNum,
      });
      if (addToSemester && data.id) {
        await api.post("/api/admin/semester-courses/courses", {
          semester,
          courseId: data.id,
        });
      }
      onDone();
    } catch (err) {
      const msg = serverError(err, "Failed to create course");
      setError(msg);
      if (err.response?.status === 409) onError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <section
        aria-label="Create new course"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-2xl border border-[#45454e] bg-[#2e2e35] p-10 pb-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <h2 className="mb-2 text-2xl font-bold">New course</h2>
        <p className="mb-[26px] text-[15px] text-[#b9b9c2]">Creates the course in the database.</p>

        <form onSubmit={onSubmit} noValidate>
          <label className="mb-2 block text-sm font-semibold" htmlFor="c-code">Course code</label>
          <input
            id="c-code"
            type="text"
            placeholder="CSE101"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <label className="mb-2 block text-sm font-semibold" htmlFor="c-title">Title</label>
          <input
            id="c-title"
            type="text"
            placeholder="Introduction to Programming"
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
          />

          <div className="flex gap-3">
            <div className="w-full">
              <label className="mb-2 block text-sm font-semibold" htmlFor="c-type">Type</label>
              <select
                id="c-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none focus:border-[#8f8f9a]"
              >
                <option value="Theory">Theory</option>
                <option value="Lab">Lab</option>
                <option value="Viva-Voce">Viva-Voce</option>
              </select>
            </div>
            <div className="w-full">
              <label className="mb-2 block text-sm font-semibold" htmlFor="c-credit">Credit</label>
              <input
                id="c-credit"
                type="number"
                min="0"
                max="10"
                step="0.5"
                placeholder="3"
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                required
                className="mb-5 w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[14px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]"
              />
            </div>
          </div>

          <label className="mb-6 flex cursor-pointer items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={addToSemester}
              onChange={(e) => setAddToSemester(e.target.checked)}
              className="h-4 w-4"
            />
            Add to {ordinal(semester)} Semester after creating
          </label>

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
