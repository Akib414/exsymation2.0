import { useEffect, useRef, useState } from "react";

import api from "../../api/client.js";
import {
  Badge,
  Card,
  DetailRow,
  Drawer,
  EmptyNote,
  ErrorBanner,
  Section,
  formatDate,
  inputClass,
  serverError,
  statusTone,
} from "./ui.jsx";

function committeeRole(committee, teacherId) {
  const id = String(teacherId);
  if (String(committee.chairman) === id) return "Chairman";
  if (String(committee.member1) === id) return "Member 1";
  if (String(committee.member2) === id) return "Member 2";
  if (String(committee.tabulator1) === id) return "Tabulator 1";
  if (String(committee.tabulator2) === id) return "Tabulator 2";
  return "Member";
}

function assignmentRole(assignment, teacherId) {
  const id = String(teacherId);
  if ((assignment.firstExaminers || []).some((value) => String(value) === id)) {
    return "First examiner";
  }
  if (String(assignment.secondExaminer) === id) return "Second examiner";
  if (assignment.thirdExaminer?.teacher && String(assignment.thirdExaminer.teacher) === id) {
    return "Third examiner";
  }
  return "Examiner";
}

export default function TeachersPanel() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = {};
        if (status) params.status = status;
        if (query.trim()) params.q = query.trim();
        const { data } = await api.get("/api/chairman/teachers", { params });
        if (!cancelled) setTeachers(data.teachers || []);
      } catch (err) {
        if (!cancelled) setError(serverError(err, "Failed to load teachers"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, status]);

  async function openTeacher(teacher) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setSelected(teacher);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/api/chairman/teachers/${teacher.id}`);
      if (requestRef.current === requestId) setDetail(data.data);
    } catch (err) {
      if (requestRef.current === requestId) {
        setDetailError(serverError(err, "Failed to load teacher details"));
      }
    } finally {
      if (requestRef.current === requestId) setDetailLoading(false);
    }
  }

  function closeDetail() {
    requestRef.current += 1;
    setSelected(null);
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Teachers</h1>
          <p className="mt-1 text-[15px] text-[#b9b9c2]">
            Review teaching staff, current committee work, and examination duties.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-full sm:w-64">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
              className={inputClass}
              aria-label="Search teachers"
            />
          </div>
          <div className="w-full sm:w-40">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={inputClass}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      {loading ? (
        <EmptyNote>Loading teachers…</EmptyNote>
      ) : teachers.length === 0 ? (
        <EmptyNote>No teachers match the current filters.</EmptyNote>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#45454e]">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-[#45454e] bg-[#2e2e35] text-sm text-[#b9b9c2]">
                <th className="px-5 py-3 font-semibold">TEACHER</th>
                <th className="px-5 py-3 font-semibold">PHONE</th>
                <th className="px-5 py-3 font-semibold">STATUS</th>
                <th className="px-5 py-3 font-semibold">CURRENT ACTIVITY</th>
                <th className="px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id} className="border-b border-[#45454e] last:border-0">
                  <td className="px-5 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => openTeacher(teacher)}
                      className="text-left font-semibold underline-offset-4 hover:underline"
                    >
                      {teacher.name}
                    </button>
                    <p className="text-xs text-[#8f8f9a]">{teacher.email}</p>
                    {teacher.isChairman && (
                      <div className="mt-1">
                        <Badge tone="info">Chairman</Badge>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top text-[#b9b9c2]">{teacher.phone || "—"}</td>
                  <td className="px-5 py-3 align-top">
                    <Badge tone={statusTone(teacher.status)}>{teacher.status}</Badge>
                  </td>
                  <td className="px-5 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {teacher.committeeCount > 0 && (
                        <Badge>Committee ×{teacher.committeeCount}</Badge>
                      )}
                      {teacher.assignmentCount > 0 && (
                        <Badge>Examiner ×{teacher.assignmentCount}</Badge>
                      )}
                      {teacher.invigilationCount > 0 && (
                        <Badge>Invigilator ×{teacher.invigilationCount}</Badge>
                      )}
                      {teacher.committeeCount === 0 &&
                        teacher.assignmentCount === 0 &&
                        teacher.invigilationCount === 0 && (
                          <span className="text-sm text-[#8f8f9a]">No current duties</span>
                        )}
                    </div>
                  </td>
                  <td className="px-5 py-3 align-top text-right">
                    <button
                      type="button"
                      onClick={() => openTeacher(teacher)}
                      className="rounded-xl border border-[#55555f] px-4 py-2 text-sm font-semibold"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <Drawer
          title={selected.name}
          subtitle={selected.email}
          onClose={closeDetail}
        >
          {detailLoading && <EmptyNote>Loading teacher details…</EmptyNote>}
          <ErrorBanner>{detailError}</ErrorBanner>
          {detail && (
            <>
              <div className="mb-5 flex flex-wrap gap-2">
                <Badge tone={statusTone(detail.teacher.status)}>{detail.teacher.status}</Badge>
                {detail.teacher.mustChangePassword && (
                  <Badge tone="info">Password change pending</Badge>
                )}
                {detail.roles.map((role) => (
                  <Badge key={role}>{role}</Badge>
                ))}
              </div>

              <Section title="Contact">
                <DetailRow label="Email" value={detail.teacher.email} />
                <DetailRow label="Phone" value={detail.teacher.phone || "—"} />
                <DetailRow label="Joined" value={formatDate(detail.teacher.createdAt)} />
              </Section>

              {detail.chairmanTerms.length > 0 && (
                <Section title="Chairman terms" count={detail.chairmanTerms.length}>
                  <div className="flex flex-col gap-2">
                    {detail.chairmanTerms.map((term) => (
                      <Card key={term.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {formatDate(term.startDate)} –{" "}
                            {term.endDate ? formatDate(term.endDate) : "present"}
                          </p>
                        </div>
                        <Badge tone={statusTone(term.status)}>{term.status}</Badge>
                      </Card>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Committees" count={detail.committees.length}>
                {detail.committees.length === 0 ? (
                  <EmptyNote>No committee memberships.</EmptyNote>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.committees.map((committee) => (
                      <Card key={committee._id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {committee.session?.session || "Session"} ·{" "}
                              {committee.session?.batch || "Batch"} · Semester{" "}
                              {committee.semester}
                            </p>
                            <p className="text-xs text-[#8f8f9a]">
                              {formatDate(committee.start)} – {formatDate(committee.end)}
                            </p>
                          </div>
                          <Badge>{committeeRole(committee, detail.teacher.id)}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Course assignments" count={detail.assignments.length}>
                {detail.assignments.length === 0 ? (
                  <EmptyNote>No examiner assignments.</EmptyNote>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.assignments.map((assignment) => (
                      <Card key={assignment._id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {assignment.course?.course_code || "Course"} —{" "}
                              {assignment.course?.course_name || ""}
                            </p>
                            <p className="text-xs text-[#8f8f9a]">
                              {assignment.session?.session || "Session"} · Semester{" "}
                              {assignment.semester}
                            </p>
                          </div>
                          <Badge>{assignmentRole(assignment, detail.teacher.id)}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Invigilation duties" count={detail.duties.length}>
                {detail.duties.length === 0 ? (
                  <EmptyNote>No invigilation duties.</EmptyNote>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.duties.map((duty) => (
                      <Card key={duty._id}>
                        <p className="text-sm font-semibold">
                          {duty.course?.course_code || "Course"} —{" "}
                          {duty.course?.course_name || ""}
                        </p>
                        <p className="text-xs text-[#8f8f9a]">
                          {formatDate(duty.date)} · {duty.time} ·{" "}
                          {duty.session?.session || "Session"}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </Drawer>
      )}

      {!loading && teachers.length > 0 && (
        <p className="mt-3 text-xs text-[#8f8f9a]">
          Showing {teachers.length} {teachers.length === 1 ? "teacher" : "teachers"}. Private
          identifiers are not shown.
        </p>
      )}
    </div>
  );
}
