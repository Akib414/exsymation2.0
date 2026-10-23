import { useEffect, useState } from "react";

import api from "../../api/client.js";

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

function DetailRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#8f8f9b]">{label}</dt>
      <dd className="mt-1 text-[15px] text-[#f2f2f4]">{value}</dd>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="border-t border-[#45454e] px-6 py-6">
      <h3 className="text-lg font-bold">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-[#b9b9c2]">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[#45454e] bg-[#34333c] p-4">
      <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#b9b9c2]">{hint}</p> : null}
    </div>
  );
}

function EmptyNote({ children }) {
  return <p className="text-sm text-[#b9b9c2]">{children}</p>;
}

function buildCourseRows(data) {
  const map = new Map();
  for (const course of data.courses || []) {
    map.set(String(course.id), {
      id: String(course.id),
      course_code: course.course_code,
      course_name: course.course_name,
      course_credit: course.course_credit,
      teachers: [],
    });
  }

  for (const assignment of data.assignments || []) {
    const courseId = String(assignment.course?._id || assignment.course);
    if (!map.has(courseId)) {
      map.set(courseId, {
        id: courseId,
        course_code: assignment.course?.course_code,
        course_name: assignment.course?.course_name,
        course_credit: assignment.course?.course_credit,
        teachers: [],
      });
    }
    const row = map.get(courseId);
    row.teachers = [];
    for (const teacher of assignment.firstExaminers || []) {
      row.teachers.push({ name: teacher.name, role: "First examiner" });
    }
    if (assignment.secondExaminer?.name) {
      row.teachers.push({ name: assignment.secondExaminer.name, role: "Second examiner" });
    }
    if (assignment.thirdExaminer?.teacher?.name) {
      row.teachers.push({ name: assignment.thirdExaminer.teacher.name, role: "Third examiner" });
    }
  }

  return [...map.values()];
}

export default function BatchDetailDrawer({ batch, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDetail(null);
    (async () => {
      try {
        const res = await api.get(`/api/chairman/batches/${batch.id}`);
        if (!cancelled) setDetail(res.data?.data || null);
      } catch {
        if (!cancelled) setError("Could not load batch details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batch.id, attempt]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const data = detail || {};
  const batchData = data.batch || batch;
  const courseRows = buildCourseRows(data);
  const assignedCourses = courseRows.filter((course) => course.teachers.length > 0).length;
  const coverage = courseRows.length
    ? Math.round((assignedCourses / courseRows.length) * 100)
    : null;
  const activeCommittee = (data.committees || []).find(
    (committee) =>
      committee.status === "active" &&
      Number(committee.semester) === Number(batchData.current_semester)
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close batch details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-detail-title"
        className="relative flex h-full w-full max-w-[680px] flex-col overflow-y-auto border-l border-[#45454e] bg-[#2e2e35] text-[#f2f2f4] shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <header className="sticky top-0 z-10 border-b border-[#45454e] bg-[#2e2e35] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">Batch details</p>
              <h2 id="batch-detail-title" className="mt-1 text-2xl font-bold">
                {batchData.batch} · {batchData.session}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={batchData.status} />
                <span className="rounded-full bg-[#34333c] px-2.5 py-1 text-xs font-semibold text-[#d7d7dd]">
                  Semester {batchData.current_semester}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#55555f] px-4 py-2 text-sm font-semibold text-[#f2f2f4]"
            >
              Close
            </button>
          </div>
        </header>

        {error ? (
          <div className="border-t border-[#45454e] px-6 py-6">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#7a3b40] bg-[#3a2a2c] px-4 py-3 text-sm text-[#ffd9dc]">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="rounded-lg bg-[#ffd9dc] px-3 py-1.5 font-semibold text-[#3a2a2c]"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="px-6 py-6 text-sm text-[#b9b9c2]">Loading batch details…</p>
        ) : (
          <div>
            <Section title="Batch overview">
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailRow label="Batch" value={batchData.batch} />
                <DetailRow label="Academic session" value={batchData.session} />
                <DetailRow label="Department / program" value="Not recorded" />
                <DetailRow label="Current semester" value={`Semester ${batchData.current_semester}`} />
                <DetailRow label="Recorded students" value={batchData.student_number} />
                <DetailRow label="Batch status" value={batchData.status === "active" ? "Active" : "Inactive"} />
              </dl>
            </Section>

            <Section
              title="Student statistics"
              subtitle="Based on the enrollment data available in Exsymation 2.0."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Recorded students"
                  value={batchData.student_number}
                  hint="Recorded batch enrollment"
                />
                <StatTile label="Active students" value="Not available" hint="No per-student records" />
                <StatTile label="Inactive / withdrawn" value="Not available" hint="No per-student records" />
              </div>
              <p className="mt-3 text-xs text-[#8f8f9b]">
                Exsymation 2.0 stores a recorded student count for each batch, not individual
                student enrollment records, so active/inactive student counts cannot be derived.
              </p>
            </Section>

            <Section
              title="Courses assigned to the batch"
              subtitle={`Current term: Semester ${batchData.current_semester}. Teacher assignments are recorded as examiner roles.`}
            >
              {courseRows.length === 0 ? (
                <EmptyNote>No courses are configured for this batch in the current term.</EmptyNote>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#45454e]">
                  <table className="w-full min-w-[540px] text-left text-sm">
                    <thead className="bg-[#34333c] text-xs uppercase tracking-wide text-[#b9b9c2]">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">Course</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Credits</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Assigned teachers</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseRows.map((course) => (
                        <tr key={course.id} className="border-t border-[#45454e] align-top">
                          <td className="px-4 py-3">
                            <p className="font-semibold">{course.course_code}</p>
                            <p className="text-[#b9b9c2]">{course.course_name}</p>
                          </td>
                          <td className="px-4 py-3 text-[#b9b9c2]">{course.course_credit ?? "—"}</td>
                          <td className="px-4 py-3">
                            {course.teachers.length === 0 ? (
                              <span className="text-[#b9b9c2]">Unassigned</span>
                            ) : (
                              <ul className="flex flex-col gap-1">
                                {course.teachers.map((teacher) => (
                                  <li key={`${course.id}-${teacher.name}-${teacher.role}`}>
                                    {teacher.name}{" "}
                                    <span className="text-xs text-[#8f8f9b]">({teacher.role})</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-[#34333c] px-2.5 py-1 text-xs font-semibold text-[#d7d7dd]">
                              Not tracked
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section
              title="Academic progress"
              subtitle="Derived only from records that Exsymation 2.0 currently maintains."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label="Courses this term" value={courseRows.length} />
                <StatTile label="With assigned teachers" value={assignedCourses} />
                <StatTile
                  label="Allocation coverage"
                  value={coverage === null ? "—" : `${coverage}%`}
                  hint="Courses with at least one assigned examiner"
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <StatTile
                  label="Scheduled exam routines"
                  value={data.routines?.length || 0}
                  hint="Current-term routines on record"
                />
                <StatTile
                  label="Examination committee"
                  value={activeCommittee ? "Active" : "Not active"}
                  hint={
                    activeCommittee
                      ? `Formed ${formatDate(activeCommittee.start)}`
                      : `No active committee for Semester ${batchData.current_semester}`
                  }
                />
              </div>
              <p className="mt-3 text-xs text-[#8f8f9b]">
                Course completion and result progress are not tracked per course in Exsymation 2.0,
                so no completion percentage is calculated. Allocation coverage is the share of
                current-term courses with at least one assigned examiner.
              </p>
            </Section>
          </div>
        )}
      </aside>
    </div>
  );
}
