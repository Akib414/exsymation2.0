import { useEffect, useState } from "react";

import api from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import {
  Badge,
  DetailRow,
  Drawer,
  EmptyNote,
  ErrorBanner,
  Modal,
  Section,
  formatDate,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  serverError,
  statusTone,
  toDateInput,
} from "./ui.jsx";

function teacherName(value) {
  if (!value) return "—";
  return value.name || "—";
}

function teacherId(value) {
  if (!value) return "";
  return String(value._id || value);
}

function todayInput() {
  return toDateInput(new Date());
}

function plusDaysInput(days) {
  return toDateInput(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

export default function CommitteesPanel() {
  const { user } = useAuth();
  const [committees, setCommittees] = useState([]);
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ session: "", semester: "", status: "" });
  const [form, setForm] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  async function loadCommittees(activeFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (activeFilters.session) params.session = activeFilters.session;
      if (activeFilters.semester) params.semester = activeFilters.semester;
      if (activeFilters.status) params.status = activeFilters.status;
      const { data } = await api.get("/api/committees", { params });
      setCommittees(data.data || []);
    } catch (err) {
      setError(serverError(err, "Failed to load committees"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [batchesRes, teachersRes] = await Promise.all([
          api.get("/api/chairman/batches"),
          api.get("/api/chairman/teachers", { params: { status: "active" } }),
        ]);
        if (cancelled) return;
        setBatches(batchesRes.data?.batches || []);
        setTeachers(teachersRes.data?.teachers || []);
      } catch (err) {
        if (!cancelled) setError(serverError(err, "Failed to load reference data"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadCommittees(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function confirmDeactivate() {
    if (!pendingDeactivate) return;
    setDeactivating(true);
    setDeactivateError("");
    try {
      await api.delete(`/api/committees/${pendingDeactivate._id}`);
      setPendingDeactivate(null);
      setViewing(null);
      await loadCommittees();
    } catch (err) {
      setDeactivateError(serverError(err, "Failed to deactivate committee"));
    } finally {
      setDeactivating(false);
    }
  }

  async function afterSave() {
    setForm(null);
    setViewing(null);
    await loadCommittees();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Exam committees</h1>
          <p className="mt-1 text-[15px] text-[#b9b9c2]">
            Create, inspect, update, and close examination committees.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ mode: "create", committee: null })}
          className={primaryButtonClass}
        >
          Create committee
        </button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="filter-session">
            Session
          </label>
          <select
            id="filter-session"
            value={filters.session}
            onChange={(event) => updateFilter("session", event.target.value)}
            className={inputClass}
          >
            <option value="">All sessions</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.session} · {batch.batch}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="filter-semester">
            Semester
          </label>
          <select
            id="filter-semester"
            value={filters.semester}
            onChange={(event) => updateFilter("semester", event.target.value)}
            className={inputClass}
          >
            <option value="">All semesters</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((semester) => (
              <option key={semester} value={semester}>
                Semester {semester}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            className={inputClass}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      {loading ? (
        <EmptyNote>Loading committees…</EmptyNote>
      ) : committees.length === 0 ? (
        <EmptyNote>No committees match the current filters.</EmptyNote>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#45454e]">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-[#45454e] bg-[#2e2e35] text-sm text-[#b9b9c2]">
                <th className="px-5 py-3 font-semibold">COMMITTEE</th>
                <th className="px-5 py-3 font-semibold">CHAIRMAN</th>
                <th className="px-5 py-3 font-semibold">MEMBERS</th>
                <th className="px-5 py-3 font-semibold">DURATION</th>
                <th className="px-5 py-3 font-semibold">STATUS</th>
                <th className="px-5 py-3 font-semibold">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {committees.map((committee) => (
                <tr key={committee._id} className="border-b border-[#45454e] last:border-0 align-top">
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setViewing(committee)}
                      className="text-left font-semibold underline-offset-4 hover:underline"
                    >
                      {committee.session?.session || "Session"} ·{" "}
                      {committee.session?.batch || "Batch"}
                    </button>
                    <p className="text-xs text-[#8f8f9a]">Semester {committee.semester}</p>
                  </td>
                  <td className="px-5 py-3 text-[#b9b9c2]">{teacherName(committee.chairman)}</td>
                  <td className="px-5 py-3 text-[#b9b9c2]">
                    {teacherName(committee.member1)}, {teacherName(committee.member2)}
                    {committee.external?.name && (
                      <p className="text-xs text-[#8f8f9a]">
                        External: {committee.external.name}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[#b9b9c2]">
                    {formatDate(committee.start)} – {formatDate(committee.end)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(committee.status)}>{committee.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setViewing(committee)}
                        className="rounded-xl border border-[#55555f] px-3 py-1.5 text-sm font-semibold"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ mode: "edit", committee })}
                        className="rounded-xl border border-[#55555f] px-3 py-1.5 text-sm font-semibold"
                      >
                        Edit
                      </button>
                      {committee.status === "active" && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeactivateError("");
                            setPendingDeactivate(committee);
                          }}
                          className="rounded-xl border border-[#7a3b40] px-3 py-1.5 text-sm font-semibold text-[#ffd9dc]"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <CommitteeDetail
          committee={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => setForm({ mode: "edit", committee: viewing })}
          onDeactivate={() => {
            setDeactivateError("");
            setPendingDeactivate(viewing);
          }}
        />
      )}

      {form && (
        <CommitteeForm
          mode={form.mode}
          committee={form.committee}
          batches={batches}
          teachers={teachers}
          currentUserId={user?.id || ""}
          currentUserName={user?.name || "Current chairman"}
          onClose={() => setForm(null)}
          onSaved={afterSave}
        />
      )}

      {pendingDeactivate && (
        <Modal
          title="Deactivate committee?"
          subtitle={`${pendingDeactivate.session?.session || "Session"} · ${
            pendingDeactivate.session?.batch || "Batch"
          } · Semester ${pendingDeactivate.semester}`}
          onClose={() => setPendingDeactivate(null)}
        >
          <p className="mb-5 text-[15px] text-[#b9b9c2]">
            The committee will be marked inactive. Historical data is preserved and the record
            is not deleted.
          </p>
          <ErrorBanner>{deactivateError}</ErrorBanner>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPendingDeactivate(null)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeactivate}
              disabled={deactivating}
              className="rounded-xl border border-[#7a3b40] bg-transparent px-4 py-2 text-sm font-semibold text-[#ffd9dc] disabled:opacity-60"
            >
              {deactivating ? "Deactivating…" : "Deactivate"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CommitteeDetail({ committee, onClose, onEdit, onDeactivate }) {
  return (
    <Drawer
      title={`${committee.session?.session || "Session"} · ${
        committee.session?.batch || "Batch"
      }`}
      subtitle={`Semester ${committee.semester}`}
      onClose={onClose}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(committee.status)}>{committee.status}</Badge>
        <button type="button" onClick={onEdit} className={ghostButtonClass}>
          Edit
        </button>
        {committee.status === "active" && (
          <button
            type="button"
            onClick={onDeactivate}
            className="rounded-xl border border-[#7a3b40] px-4 py-2 text-sm font-semibold text-[#ffd9dc]"
          >
            Deactivate
          </button>
        )}
      </div>

      <Section title="Committee">
        <DetailRow label="Session" value={committee.session?.session} />
        <DetailRow label="Batch" value={committee.session?.batch} />
        <DetailRow label="Semester" value={committee.semester} />
        <DetailRow label="Start" value={formatDate(committee.start)} />
        <DetailRow label="End" value={formatDate(committee.end)} />
        <DetailRow label="Status" value={committee.status} />
      </Section>

      <Section title="Members">
        <DetailRow label="Chairman" value={teacherName(committee.chairman)} />
        <DetailRow label="Member 1" value={teacherName(committee.member1)} />
        <DetailRow label="Member 2" value={teacherName(committee.member2)} />
        <DetailRow label="Tabulator 1" value={teacherName(committee.tabulator1)} />
        <DetailRow label="Tabulator 2" value={teacherName(committee.tabulator2)} />
      </Section>

      {committee.external?.name && (
        <Section title="External member">
          <DetailRow label="Name" value={committee.external.name} />
          <DetailRow label="Institution" value={committee.external.institution || "—"} />
          <DetailRow label="Phone" value={committee.external.phone || "—"} />
        </Section>
      )}
    </Drawer>
  );
}

function CommitteeForm({
  mode,
  committee,
  batches,
  teachers,
  currentUserId,
  currentUserName,
  onClose,
  onSaved,
}) {
  const isEdit = mode === "edit";
  const chairman = isEdit
    ? teacherId(committee.chairman) || currentUserId
    : currentUserId;
  const chairmanName = isEdit
    ? teacherName(committee.chairman) || currentUserName
    : currentUserName;

  const [session, setSession] = useState(
    isEdit ? teacherId(committee.session) : ""
  );
  const [semester, setSemester] = useState(
    isEdit ? committee.semester : 1
  );
  const [start, setStart] = useState(
    isEdit ? toDateInput(committee.start) : todayInput()
  );
  const [end, setEnd] = useState(
    isEdit ? toDateInput(committee.end) : plusDaysInput(30)
  );
  const [member1, setMember1] = useState(
    isEdit ? teacherId(committee.member1) : ""
  );
  const [member2, setMember2] = useState(
    isEdit ? teacherId(committee.member2) : ""
  );
  const [tabulator1, setTabulator1] = useState(
    isEdit ? teacherId(committee.tabulator1) : ""
  );
  const [tabulator2, setTabulator2] = useState(
    isEdit ? teacherId(committee.tabulator2) : ""
  );
  const [externalName, setExternalName] = useState(
    isEdit ? committee.external?.name || "" : ""
  );
  const [externalInstitution, setExternalInstitution] = useState(
    isEdit ? committee.external?.institution || "" : ""
  );
  const [externalPhone, setExternalPhone] = useState(
    isEdit ? committee.external?.phone || "" : ""
  );
  const [status, setStatus] = useState(isEdit ? committee.status : "active");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const candidates = teachers.filter((teacher) => teacher.id !== chairman);

  function optionsFor(excludeIds) {
    return candidates.filter((teacher) => !excludeIds.includes(teacher.id));
  }

  function validate() {
    if (!session) return "Select a session/batch.";
    if (!Number.isInteger(Number(semester)) || Number(semester) < 1) {
      return "Select a valid semester.";
    }
    if (!start || !end) return "Select the committee start and end dates.";
    if (start > end) return "End date cannot be before the start date.";
    if (!member1 || !member2) return "Select both committee members.";
    if (member1 === member2) return "Committee members must be different teachers.";
    const selected = [chairman, member1, member2, tabulator1, tabulator2].filter(Boolean);
    if (new Set(selected).size !== selected.length) {
      return "Each committee slot must be a different teacher.";
    }
    return "";
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    const payload = {
      chairman,
      member1,
      member2,
      session,
      semester: Number(semester),
      start: new Date(`${start}T00:00:00`).toISOString(),
      end: new Date(`${end}T23:59:59.999`).toISOString(),
      status,
    };
    if (tabulator1) payload.tabulator1 = tabulator1;
    if (tabulator2) payload.tabulator2 = tabulator2;
    if (isEdit) {
      // Send explicit nulls so optional slots/external members can be cleared.
      payload.tabulator1 = tabulator1 || null;
      payload.tabulator2 = tabulator2 || null;
      payload.external = externalName.trim()
        ? {
            name: externalName.trim(),
            ...(externalInstitution.trim() ? { institution: externalInstitution.trim() } : {}),
            ...(externalPhone.trim() ? { phone: externalPhone.trim() } : {}),
          }
        : null;
    } else if (externalName.trim()) {
      payload.external = {
        name: externalName.trim(),
        ...(externalInstitution.trim() ? { institution: externalInstitution.trim() } : {}),
        ...(externalPhone.trim() ? { phone: externalPhone.trim() } : {}),
      };
    }

    setBusy(true);
    try {
      if (isEdit) {
        await api.patch(`/api/committees/${committee._id}`, payload);
      } else {
        await api.post("/api/committees", payload);
      }
      onSaved();
    } catch (err) {
      setError(serverError(err, `Failed to ${isEdit ? "update" : "create"} committee`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={isEdit ? "Edit exam committee" : "Create exam committee"}
      subtitle={
        isEdit
          ? "Update the committee members, schedule, or status."
          : "Appoint members and define the committee term."
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4 rounded-xl border border-[#3f5a7a] bg-[#26313e] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#c5dcff]">
            Committee chairman
          </p>
          <p className="text-sm font-semibold">{chairmanName}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="cm-session">
              Session / batch
            </label>
            <select
              id="cm-session"
              value={session}
              onChange={(event) => setSession(event.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select session…</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.session} · {batch.batch}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-semester">
              Semester
            </label>
            <select
              id="cm-semester"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className={inputClass}
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  Semester {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-start">
              Start date
            </label>
            <input
              id="cm-start"
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-end">
              End date
            </label>
            <input
              id="cm-end"
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>

        <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-[#b9b9c2]">
          Teacher members
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="cm-member1">
              Member 1
            </label>
            <select
              id="cm-member1"
              value={member1}
              onChange={(event) => setMember1(event.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select teacher…</option>
              {optionsFor([member2, tabulator1, tabulator2]).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} — {teacher.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-member2">
              Member 2
            </label>
            <select
              id="cm-member2"
              value={member2}
              onChange={(event) => setMember2(event.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select teacher…</option>
              {optionsFor([member1, tabulator1, tabulator2]).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} — {teacher.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-tab1">
              Tabulator 1 (optional)
            </label>
            <select
              id="cm-tab1"
              value={tabulator1}
              onChange={(event) => setTabulator1(event.target.value)}
              className={inputClass}
            >
              <option value="">No tabulator</option>
              {optionsFor([member1, member2, tabulator2]).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} — {teacher.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-tab2">
              Tabulator 2 (optional)
            </label>
            <select
              id="cm-tab2"
              value={tabulator2}
              onChange={(event) => setTabulator2(event.target.value)}
              className={inputClass}
            >
              <option value="">No tabulator</option>
              {optionsFor([member1, member2, tabulator1]).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} — {teacher.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-[#b9b9c2]">
          External member (optional)
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="cm-ext-name">
              Name
            </label>
            <input
              id="cm-ext-name"
              type="text"
              value={externalName}
              onChange={(event) => setExternalName(event.target.value)}
              className={inputClass}
              placeholder="External member name"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-ext-inst">
              Institution
            </label>
            <input
              id="cm-ext-inst"
              type="text"
              value={externalInstitution}
              onChange={(event) => setExternalInstitution(event.target.value)}
              className={inputClass}
              placeholder="Institution"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-ext-phone">
              Phone
            </label>
            <input
              id="cm-ext-phone"
              type="text"
              value={externalPhone}
              onChange={(event) => setExternalPhone(event.target.value)}
              className={inputClass}
              placeholder="Phone number"
            />
          </div>
        </div>

        {isEdit && (
          <div className="mt-4 sm:w-40">
            <label className={labelClass} htmlFor="cm-status">
              Status
            </label>
            <select
              id="cm-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={inputClass}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}

        <ErrorBanner>{error}</ErrorBanner>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className={`${ghostButtonClass} w-full`}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full`}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create committee"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
