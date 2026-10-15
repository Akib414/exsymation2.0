import { useState } from "react";

import { useAdminAuth } from "../auth/AdminAuthContext.jsx";
import TeachersPanel from "../components/admin/TeachersPanel.jsx";
import ChairmanPanel from "../components/admin/ChairmanPanel.jsx";
import CoursesPanel from "../components/admin/CoursesPanel.jsx";
import BatchesPanel from "../components/admin/BatchesPanel.jsx";
import ChangePasswordPanel from "../components/admin/ChangePasswordPanel.jsx";

const NAV = [
  { key: "dashboard", label: "Dashboard" },
  { key: "teachers", label: "Teachers" },
  { key: "chairman", label: "Chairman" },
  { key: "courses", label: "Courses" },
  { key: "batches", label: "Batches" },
  { key: "change-password", label: "Change password" },
];

export default function AdminDashboard() {
  const { adminLogout } = useAdminAuth();
  const [selected, setSelected] = useState("dashboard");

  return (
    <div className="min-h-screen flex bg-[#232329] text-[#f2f2f4]">
      <aside className="w-60 shrink-0 border-r border-[#45454e] bg-[#2e2e35] p-4">
        <div className="mb-6 flex items-center gap-3 px-2 pt-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f2f4] text-base font-extrabold text-[#232329]">
            E
          </span>
          <span className="text-[15px] font-bold">Exsymation · Admin</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.key}
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

      <div className="flex flex-1 flex-col">
        <header className="border-b border-[#45454e] bg-[#2e2e35]">
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-[15px] font-semibold">Welcome Admin</span>
            <button
              onClick={adminLogout}
              className="rounded-xl bg-[#f2f2f4] px-4 py-2 text-sm font-semibold text-[#232329]"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="px-6 py-10">
          {selected === "teachers" ? (
            <TeachersPanel />
          ) : selected === "chairman" ? (
            <ChairmanPanel />
          ) : selected === "courses" ? (
            <CoursesPanel />
          ) : selected === "batches" ? (
            <BatchesPanel />
          ) : selected === "change-password" ? (
            <ChangePasswordPanel />
          ) : (
            <>
              <h1 className="mb-2 text-2xl font-bold">
                {selected === "dashboard"
                  ? "Admin dashboard"
                  : NAV.find((item) => item.key === selected)?.label}
              </h1>
              <p className="text-[15px] text-[#b9b9c2]">Nothing here yet.</p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
