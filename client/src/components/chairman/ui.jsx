export function serverError(err, fallback) {
  const details = err.response?.data?.details?.fieldErrors;
  const firstDetail = (details && Object.values(details).flat()[0]) || null;
  return firstDetail || err.response?.data?.error || fallback;
}

export function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function statusTone(status) {
  return status === "active" ? "success" : "danger";
}

const TONES = {
  default: "border-[#55555f] bg-[#34333c] text-[#d7d7dd]",
  success: "border-[#3f6b4f] bg-[#24352a] text-[#b7ecc6]",
  danger: "border-[#7a3b40] bg-[#4a2b2e] text-[#ffd9dc]",
  info: "border-[#3f5a7a] bg-[#26313e] text-[#c5dcff]",
};

export function Badge({ tone = "default", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        TONES[tone] || TONES.default
      }`}
    >
      {children}
    </span>
  );
}

export function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-[10px] border border-[#7a3b40] bg-[#4a2b2e] px-3 py-2.5 text-sm text-[#ffd9dc]"
    >
      {children}
    </p>
  );
}

export function EmptyNote({ children }) {
  return <p className="text-[15px] text-[#b9b9c2]">{children}</p>;
}

export function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#3a3a43] py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-[#b9b9c2]">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-semibold">{value ?? "—"}</span>
    </div>
  );
}

export function Section({ title, count, action, children }) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[#b9b9c2]">
          {title}
          {typeof count === "number" && <span className="ml-2 font-normal">({count})</span>}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-[#45454e] bg-[#34333c] px-4 py-3 ${className}`}>
      {children}
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose} role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-[560px] flex-col border-l border-[#45454e] bg-[#2e2e35] shadow-[-20px_0_60px_rgba(0,0,0,0.45)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#45454e] px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-[#b9b9c2]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-[#55555f] px-3 py-1.5 text-sm font-semibold text-[#f2f2f4]"
          >
            Close
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose} role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`max-h-[90vh] w-full ${
          wide ? "max-w-[760px]" : "max-w-[520px]"
        } overflow-y-auto rounded-2xl border border-[#45454e] bg-[#2e2e35] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            {subtitle && <p className="mt-1 text-[15px] text-[#b9b9c2]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-[#55555f] px-3 py-1.5 text-sm font-semibold text-[#f2f2f4]"
          >
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[#55555f] bg-[#34333c] px-4 py-[13px] text-[15px] outline-none placeholder:text-[#8f8f9a] focus:border-[#8f8f9a]";

export const labelClass = "mb-2 block text-sm font-semibold";

export const primaryButtonClass =
  "rounded-xl bg-[#f2f2f4] px-4 py-2.5 text-sm font-semibold text-[#232329] disabled:opacity-60";

export const ghostButtonClass =
  "rounded-xl border border-[#55555f] bg-transparent px-4 py-2 text-sm font-semibold text-[#f2f2f4] disabled:opacity-60";
