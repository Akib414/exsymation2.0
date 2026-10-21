import { useEffect, useState } from "react";

import api from "../../api/client.js";

const STATE_LABELS = {
  running: "Running",
  scheduled: "Scheduled",
  completed: "Completed",
  inactive: "Inactive",
};

const STATE_TONES = {
  running: "bg-[#233d2b] text-[#9fe0b0]",
  scheduled: "bg-[#2f3348] text-[#b3c0f5]",
  completed: "bg-[#3a3326] text-[#e7c98a]",
  inactive: "bg-[#3a2a2c] text-[#f0b3b9]",
};

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

function StateBadge({ state }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATE_TONES[state] || "bg-[#34333c] text-[#d7d7dd]"
      }`}
    >
      {STATE_LABELS[state] || state}
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

function RoleCard({ role, person, highlighted }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlighted
          ? "border-[#5b6bbd] bg-[#2c3049]"
          : "border-[#45454e] bg-[#34333c]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">{role}</p>
        {highlighted ? (
          <span className="rounded-full bg-[#3b4478] px-2.5 py-1 text-xs font-semibold text-[#d7dcff]">
            Leads committee
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-semibold">{person?.name || "—"}</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <DetailRow label="Teacher ID" value={person?.id || "—"} />
        <DetailRow label="Department / designation" value="Not recorded" />
      </dl>
    </div>
  );
}

export default function CommitteeDetailDrawer({ committee, onClose }) {
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
        const res = await api.get(`/api/chairman/committees/${committee.id}`);
        if (!cancelled) setDetail(res.data?.data || null);
      } catch {
        if (!cancelled) setError("Could not load committee details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [committee.id, attempt]);

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

  const data = detail || committee;
  const members = data.members || [];
  const chairman = data.chairman || members.find((member) => member.role === "Committee chairman");
  const member1 = data.member1 || members.find((member) => member.role === "Member 1");
  const member2 = data.member2 || members.find((member) => member.role === "Member 2");
  const supporting = members.filter(
    (member) => !["Committee chairman", "Member 1", "Member 2"].includes(member.role)
  );
  const exams = data.upcomingExams || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close committee details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="committee-detail-title"
        className="relative flex h-full w-full max-w-[640px] flex-col overflow-y-auto border-l border-[#45454e] bg-[#2e2e35] text-[#f2f2f4] shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <header className="sticky top-0 z-10 border-b border-[#45454e] bg-[#2e2e35] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">Committee details</p>
              <h2 id="committee-detail-title" className="mt-1 text-2xl font-bold">
                {data.identifier}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StateBadge state={data.state} />
                <span className="rounded-full bg-[#34333c] px-2.5 py-1 text-xs font-semibold text-[#d7d7dd]">
                  Semester {data.semester}
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
          <p className="px-6 py-6 text-sm text-[#b9b9c2]">Loading committee details…</p>
        ) : (
          <div>
            <Section title="Committee information">
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailRow label="Committee identifier" value={data.identifier} />
                <DetailRow label="Associated batch" value={data.batch || "—"} />
                <DetailRow label="Academic session" value={data.academicSession || "—"} />
                <DetailRow label="Academic term" value={`Semester ${data.semester}`} />
                <DetailRow label="Formation date" value={formatDate(data.start)} />
                <DetailRow label="End date" value={formatDate(data.end)} />
                <DetailRow label="Committee status" value={data.status === "active" ? "Active" : "Inactive"} />
                <DetailRow label="Running state" value={STATE_LABELS[data.state] || data.state} />
              </dl>
            </Section>

            <Section
              title="Committee composition"
              subtitle="One committee chairman and two designated members."
            >
              <div className="flex flex-col gap-3">
                <RoleCard role="Committee chairman" person={chairman} highlighted />
                <RoleCard role="Committee member 1" person={member1} />
                <RoleCard role="Committee member 2" person={member2} />
                {supporting.length > 0
                  ? supporting.map((member) => (
                      <div
                        key={member.id}
                        className="rounded-xl border border-[#45454e] bg-[#34333c] p-4"
                      >
                        <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">
                          {member.role}
                        </p>
                        <p className="mt-2 font-semibold">{member.name}</p>
                        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                          <DetailRow label="Teacher ID" value={member.id} />
                          <DetailRow label="Department / designation" value="Not recorded" />
                        </dl>
                      </div>
                    ))
                  : null}
                {data.external ? (
                  <div className="rounded-xl border border-[#45454e] bg-[#34333c] p-4">
                    <p className="text-xs uppercase tracking-wide text-[#8f8f9b]">
                      External member
                    </p>
                    <p className="mt-2 font-semibold">{data.external.name}</p>
                    {data.external.institution ? (
                      <p className="mt-1 text-sm text-[#b9b9c2]">{data.external.institution}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Section>

            <Section
              title="Upcoming examinations"
              subtitle="Examination routines recorded for this batch and semester, nearest first."
            >
              {exams.length === 0 ? (
                <p className="text-sm text-[#b9b9c2]">
                  No upcoming examinations are currently scheduled for this committee.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {exams.map((exam) => (
                    <li
                      key={exam.id}
                      className="rounded-xl border border-[#45454e] bg-[#34333c] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{exam.name}</p>
                          <p className="mt-1 text-sm text-[#b9b9c2]">
                            {exam.course?.code || "—"} · {data.batch || "—"} · Semester{" "}
                            {exam.semester}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#233d2b] px-2.5 py-1 text-xs font-semibold text-[#9fe0b0]">
                          {exam.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[#d7d7dd]">
                        {formatDate(exam.date)} · {exam.time || "Time not recorded"}
                        {exam.type ? ` · ${exam.type}` : ""}
                      </p>
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
