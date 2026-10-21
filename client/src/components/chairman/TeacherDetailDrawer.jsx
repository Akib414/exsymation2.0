import { useEffect, useState } from "react";

import api from "../../api/client.js";

const COMMITTEE_SLOTS = [
  ["chairman", "Committee chairman"],
  ["member1", "Member 1"],
  ["member2", "Member 2"],
  ["tabulator1", "Tabulator 1"],
  ["tabulator2", "Tabulator 2"],
];

function idOf(value) {
  return String(value?._id || value || "");
}

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

function assignmentRole(assignment, teacherId) {
  const first = assignment.firstExaminers || [];
  if (first.some((value) => idOf(value) === teacherId)) return "First examiner";
  if (idOf(assignment.secondExaminer) === teacherId) return "Second examiner";
  if (idOf(assignment.thirdExaminer?.teacher) === teacherId) return "Third examiner";
  return "Examiner";
}

function committeeRole(committee, teacherId) {
  const match = COMMITTEE_SLOTS.find(([slot]) => idOf(committee[slot]) === teacherId);
  return match ? match[1] : "Member";
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

function EmptyNote({ children }) {
  return <p className="text-sm text-[#b9b9c2]">{children}</p>;
}

export default function TeacherDetailDrawer({ teacher, onClose }) {
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
        const res = await api.get(`/api/chairman/teachers/${teacher.id}`);
        if (!cancelled) setDetail(res.data?.data || null);
      } catch {
        if (!cancelled) setError("Could not load teacher details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacher.id, attempt]);

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
  const assignments = data.assignments || [];
  const committees = (data.committees || []).filter((committee) => committee.status === "active");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close teacher details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-detail-title"
        className="relative flex h-full w-full max-w-[620px] flex-col overflow-y-auto border-l border-[#45454e] bg-[#2e2e35] text-[#f2f2f4] shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <header className="sticky top-0 z-10 border-b border-[#45454e] bg-[#2e2e35] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">Teacher details</p>
              <h2 id="teacher-detail-title" className="mt-1 text-2xl font-bold">
                {teacher.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={teacher.status} />
                {teacher.isChairman ? (
                  <span className="rounded-full bg-[#34333c] px-2.5 py-1 text-xs font-semibold text-[#d7d7dd]">
                    Department chairman
                  </span>
                ) : null}
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
          <p className="px-6 py-6 text-sm text-[#b9b9c2]">Loading teacher details…</p>
        ) : (
          <div>
            <Section
              title="Basic professional information"
              subtitle="Academic administration fields only."
            >
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailRow label="Full name" value={data.teacher?.name || teacher.name} />
                <DetailRow label="Teacher ID" value={data.teacher?.id || teacher.id} />
                <DetailRow label="Department" value="Not recorded" />
                <DetailRow label="Designation" value="Not recorded" />
                <DetailRow
                  label="Account status"
                  value={(data.teacher?.status || teacher.status) === "active" ? "Active" : "Inactive"}
                />
                <DetailRow label="Member since" value={formatDate(data.teacher?.createdAt)} />
              </dl>
            </Section>

            <Section
              title="Current courses"
              subtitle="Courses where this teacher has an assigned examiner role."
            >
              {assignments.length === 0 ? (
                <EmptyNote>No course assignments recorded.</EmptyNote>
              ) : (
                <ul className="flex flex-col gap-3">
                  {assignments.map((assignment) => (
                    <li
                      key={assignment._id}
                      className="rounded-xl border border-[#45454e] bg-[#34333c] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {assignment.course?.course_code || "Course"}{" "}
                            {assignment.course?.course_name ? `— ${assignment.course.course_name}` : ""}
                          </p>
                          <p className="mt-1 text-sm text-[#b9b9c2]">
                            Batch {assignment.session?.batch ?? "—"} · Semester{" "}
                            {assignment.semester ?? "—"} ·{" "}
                            {assignment.course?.course_credit ?? "—"} credits
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#233d2b] px-2.5 py-1 text-xs font-semibold text-[#9fe0b0]">
                            Assigned
                          </span>
                          <span className="rounded-full bg-[#34333c] px-2.5 py-1 text-xs font-semibold text-[#d7d7dd]">
                            {assignmentRole(assignment, teacher.id)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Examination committee memberships"
              subtitle="Committees where this teacher currently holds a role."
            >
              {committees.length === 0 ? (
                <EmptyNote>No examination committee memberships recorded.</EmptyNote>
              ) : (
                <ul className="flex flex-col gap-3">
                  {committees.map((committee) => (
                    <li
                      key={committee._id}
                      className="rounded-xl border border-[#45454e] bg-[#34333c] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            Exam committee · Batch {committee.session?.batch ?? "—"} · Semester{" "}
                            {committee.semester ?? "—"}
                          </p>
                          <p className="mt-1 text-sm text-[#b9b9c2]">
                            Formed {formatDate(committee.start)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#34333c] px-2.5 py-1 text-xs font-semibold text-[#d7d7dd]">
                            {committeeRole(committee, teacher.id)}
                          </span>
                          <StatusBadge status={committee.status} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </aside>
    </div>
  );
}
