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

function personName(person) {
  return person?.name || "—";
}

export default function BatchesPanel() {
  const [batches, setBatches] = useState([]);
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
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/api/chairman/batches");
        if (!cancelled) setBatches(data.batches || []);
      } catch (err) {
        if (!cancelled) setError(serverError(err, "Failed to load batches"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openBatch(batch) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setSelected(batch);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/api/chairman/batches/${batch.id}`);
      if (requestRef.current === requestId) setDetail(data.data);
    } catch (err) {
      if (requestRef.current === requestId) {
        setDetailError(serverError(err, "Failed to load batch details"));
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

  const needle = query.trim().toLowerCase();
  const visible = batches.filter((batch) => {
    if (status && batch.status !== status) return false;
    if (!needle) return true;
    return `${batch.session} ${batch.batch}`.toLowerCase().includes(needle);
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Batches</h1>
          <p className="mt-1 text-[15px] text-[#b9b9c2]">
            Review running batches, semester courses, examiner assignments, and routines.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-full sm:w-64">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search session or batch"
              className={inputClass}
              aria-label="Search batches"
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
        <EmptyNote>Loading batches…</EmptyNote>
      ) : visible.length === 0 ? (
        <EmptyNote>No batches match the current filters.</EmptyNote>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#45454e]">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-[#45454e] bg-[#2e2e35] text-sm text-[#b9b9c2]">
                <th className="px-5 py-3 font-semibold">SESSION</th>
                <th className="px-5 py-3 font-semibold">BATCH</th>
                <th className="px-5 py-3 font-semibold">SEMESTER</th>
                <th className="px-5 py-3 font-semibold">STUDENTS</th>
                <th className="px-5 py-3 font-semibold">STATUS</th>
                <th className="px-5 py-3 font-semibold">ACTIVITY</th>
                <th className="px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {visible.map((batch) => (
                <tr key={batch.id} className="border-b border-[#45454e] last:border-0">
                  <td className="px-5 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => openBatch(batch)}
                      className="text-left underline-offset-4 hover:underline"
                    >
                      {batch.session}
                    </button>
                  </td>
                  <td className="px-5 py-3">{batch.batch}</td>
                  <td className="px-5 py-3 text-[#b9b9c2]">{batch.current_semester}</td>
                  <td className="px-5 py-3">{batch.student_number}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(batch.status)}>{batch.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge>Assignments {batch.assignments}</Badge>
                      <Badge>Routines {batch.routines}</Badge>
                      <Badge>Committees {batch.committees}</Badge>
                      {batch.active_committee_semesters.length > 0 && (
                        <Badge tone="info">
                          Active committee: sem {batch.active_committee_semesters.join(", ")}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openBatch(batch)}
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
          title={`${selected.session} · ${selected.batch}`}
          subtitle={`Current semester ${selected.current_semester}`}
          onClose={closeDetail}
        >
          {detailLoading && <EmptyNote>Loading batch details…</EmptyNote>}
          <ErrorBanner>{detailError}</ErrorBanner>
          {detail && (
            <>
              <div className="mb-5 flex flex-wrap gap-2">
                <Badge tone={statusTone(detail.batch.status)}>{detail.batch.status}</Badge>
                <Badge>{detail.batch.student_number} students</Badge>
                <Badge>Semester {detail.batch.current_semester}</Badge>
              </div>

              <Section title="Batch information">
                <DetailRow label="Session" value={detail.batch.session} />
                <DetailRow label="Batch" value={detail.batch.batch} />
                <DetailRow label="Current semester" value={detail.batch.current_semester} />
                <DetailRow label="Students" value={detail.batch.student_number} />
                <DetailRow label="Created" value={formatDate(detail.batch.createdAt)} />
              </Section>

              <Section title="Courses this semester" count={detail.courses.length}>
                {detail.courses.length === 0 ? (
                  <EmptyNote>No courses are mapped to this semester.</EmptyNote>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.courses.map((course) => (
                      <Card key={course.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {course.course_code} — {course.course_name}
                          </p>
                          <p className="text-xs text-[#8f8f9a]">
                            {course.course_type} · {course.course_credit} credits
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Course assignments" count={detail.assignments.length}>
                {detail.assignments.length === 0 ? (
                  <EmptyNote>No examiner assignments for this semester.</EmptyNote>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.assignments.map((assignment) => (
                      <Card key={assignment._id}>
                        <p className="text-sm font-semibold">
                          {assignment.course?.course_code || "Course"} —{" "}
                          {assignment.course?.course_name || ""}
                        </p>
                        <dl className="mt-2 grid gap-1 text-xs text-[#b9b9c2]">
                          <div className="flex gap-2">
                            <dt className="shrink-0 font-semibold">First examiner(s):</dt>
                            <dd>
                              {(assignment.firstExaminers || []).map(personName).join(", ") || "—"}
                            </dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 font-semibold">Second examiner:</dt>
                            <dd>{personName(assignment.secondExaminer)}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 font-semibold">Third examiner:</dt>
                            <dd>
                              {personName(assignment.thirdExaminer?.teacher)}
                              {assignment.thirdExaminer?.studentCount != null
                                ? ` (${assignment.thirdExaminer.studentCount} students)`
                                : ""}
                            </dd>
                          </div>
                        </dl>
                      </Card>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Routines" count={detail.routines.length}>
                {detail.routines.length === 0 ? (
                  <EmptyNote>No routines for this semester.</EmptyNote>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.routines.map((routine) => (
                      <Card key={routine._id}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold">
                            {routine.course?.course_code || "Course"} —{" "}
                            {routine.course?.course_name || ""}
                          </p>
                          <p className="shrink-0 text-xs text-[#8f8f9a]">
                            {formatDate(routine.date)} · {routine.time}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[#b9b9c2]">
                          Invigilators:{" "}
                          {(routine.invigilators || []).map(personName).join(", ") || "—"}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Examination committees" count={detail.committees.length}>
                {detail.committees.length === 0 ? (
                  <EmptyNote>No committees for this batch.</EmptyNote>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.committees.map((committee) => (
                      <Card key={committee._id}>
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">Semester {committee.semester}</p>
                            <p className="text-xs text-[#8f8f9a]">
                              {formatDate(committee.start)} – {formatDate(committee.end)}
                            </p>
                          </div>
                          <Badge tone={statusTone(committee.status)}>{committee.status}</Badge>
                        </div>
                        <p className="text-xs text-[#b9b9c2]">
                          Chairman: {personName(committee.chairman)} · Members:{" "}
                          {personName(committee.member1)}, {personName(committee.member2)}
                        </p>
                        {(committee.tabulator1 || committee.tabulator2) && (
                          <p className="text-xs text-[#b9b9c2]">
                            Tabulators:{" "}
                            {[committee.tabulator1, committee.tabulator2]
                              .filter(Boolean)
                              .map(personName)
                              .join(", ")}
                          </p>
                        )}
                        {committee.external?.name && (
                          <p className="text-xs text-[#b9b9c2]">
                            External: {committee.external.name}
                            {committee.external.institution
                              ? ` (${committee.external.institution})`
                              : ""}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </Drawer>
      )}
    </div>
  );
}
