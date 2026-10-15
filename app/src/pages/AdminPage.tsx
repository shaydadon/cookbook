import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { AllowList } from "../components/admin/AllowList";
import { ChatImport } from "../components/admin/ChatImport";
import { EditRecipe } from "../components/admin/EditRecipe";
import { ReviewQueue } from "../components/admin/ReviewQueue";

const TABS = [
  { key: "review", label: "לטיפול", el: <ReviewQueue /> },
  { key: "edit", label: "עריכה", el: <EditRecipe /> },
  { key: "import", label: "ייבוא צ'אט", el: <ChatImport /> },
  { key: "members", label: "חברים", el: <AllowList /> },
] as const;

export default function AdminPage() {
  const { member } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("review");
  if (member?.role !== "admin") return <p className="py-8 text-center">אין הרשאה.</p>;
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-lg font-bold">ניהול</h1>
      <div role="tablist" className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-controls={`panel-${t.key}`} aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 shrink-0 rounded-full px-4 ${tab === t.key ? "bg-ink text-bg" : "border border-line bg-surface"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`} hidden={tab !== t.key}>
          {t.el}
        </div>
      ))}
    </div>
  );
}
