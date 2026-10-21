import { useState } from "react";

import { useAuth } from "../auth/AuthContext.jsx";
import OverviewPanel from "../components/chairman/OverviewPanel.jsx";
import TeachersPanel from "../components/chairman/TeachersPanel.jsx";
import BatchesPanel from "../components/chairman/BatchesPanel.jsx";
import CommitteesPanel from "../components/chairman/CommitteesPanel.jsx";

const NAV = [
  { key: "overview", label: "Overview" },
  { key: "teachers", label: "Teachers" },
  { key: "batches", label: "Batches" },
  { key: "committees", label: "Exam committees" },
];

const TITLES = {
  overview: "Chairman overview",
  teachers: "Teachers",
  batches: "Batches",
  committees: "Exam committees",
};

export default function ChairmanDashboard() {
  const { user, logout } = useAuth();
  const [selected, setSelected] = useState("overview");

  return (
    <div className="flex min-h-screen bg-[#232329] text-[#f2f2f4]">
      <aside className="w-60 shrink-0 border-r border-[#45454e] bg-[#2e2e35] p-4">
        <div className="mb-6 flex items-center gap-3 px-2 pt-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f2f4] text-base font-extrabold text-[#232329]">
            E
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight">Exsymation</p>
            <p className="text-xs text-[#b9b9c2]">Chairman</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelected(item.key)}
              className={`rounded-xl px-4 py-2.5 text-left text-[15px] font-semibold ${
                selected === item.key
                  ? "bg-[#f2f2f4] text-[#232329]"
                  : "bg-transparent text-[#b9b9c2]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#45454e] bg-[#2e2e35]">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">
                {TITLES[selected]} · {user?.name || "Chairman"}
              </p>
              <p className="truncate text-sm text-[#b9b9c2]">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="shrink-0 rounded-xl bg-[#f2f2f4] px-4 py-2 text-sm font-semibold text-[#232329]"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="px-6 py-8">
          <div className="mx-auto w-full max-w-6xl">
            {selected === "teachers" ? (
              <TeachersPanel />
            ) : selected === "batches" ? (
              <BatchesPanel />
            ) : selected === "committees" ? (
              <CommitteesPanel />
            ) : (
              <OverviewPanel onNavigate={setSelected} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
