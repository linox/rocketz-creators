"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

const map: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  review: "bg-amber-100 text-amber-900 border-amber-300",
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  paused: "bg-slate-100 text-slate-600 border-slate-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  briefing: "bg-sky-100 text-sky-800 border-sky-200",
  selection: "bg-indigo-100 text-indigo-800 border-indigo-200",
  approval: "bg-violet-100 text-violet-800 border-violet-200",
  production: "bg-orange-100 text-orange-800 border-orange-200",
  published: "bg-emerald-100 text-emerald-800 border-emerald-200",
  finished: "bg-slate-200 text-slate-700 border-slate-300",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  revision: "bg-amber-100 text-amber-900 border-amber-300",
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  planned: "bg-slate-100 text-slate-700 border-slate-200",
  in_production: "bg-orange-100 text-orange-800 border-orange-200",
  signed: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const { t } = useTranslation("app");
  if (!status) return null;
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase", map[status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}
