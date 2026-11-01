"use client";

import { Package, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  delivered: "border-emerald-300 bg-emerald-50 text-emerald-800",
  handed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  pending: "border-slate-200 bg-slate-50 text-slate-600",
  issue: "border-rose-300 bg-rose-50 text-rose-800",
  returned: "border-rose-300 bg-rose-50 text-rose-800",
  not_found: "border-rose-300 bg-rose-50 text-rose-800",
};

export function BarterDeliveryBadge({ status, className }: { status?: string | null; className?: string }) {
  const { t } = useTranslation("app");
  const key = status || "pending";
  const delivered = key === "delivered" || key === "handed";

  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", TONE[key] ?? "border-amber-300 bg-amber-50 text-amber-800", className)}>
      {delivered ? <PackageCheck size={11} /> : <Package size={11} />}
      {t(`barterShipments.status.${key}`, { defaultValue: key })}
    </span>
  );
}
