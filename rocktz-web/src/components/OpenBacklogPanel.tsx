"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { formatMonthLabel } from "@/components/MonthScopeBar";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import { cn } from "@/lib/cn";
import type { OpenBacklogEntry } from "@/lib/open-demands";

export function OpenBacklogPanel({ items, count, variant = "full" }: { items: OpenBacklogEntry[]; count?: number; variant?: "full" | "compact" }) {
  const { t, i18n } = useTranslation("app");
  const [open, setOpen] = useState(false);
  const total = count ?? items.length;
  if (total < 1) return null;
  const locale = intlLocale(normalizeLocale(i18n.language));
  const hidden = Math.max(0, total - items.length);
  const ordered = [...items].sort((a, b) => Number(Boolean(b.late)) - Number(Boolean(a.late)) || a.month.localeCompare(b.month) || a.title.localeCompare(b.title));
  const hasLate = ordered.some((item) => item.late);

  if (variant === "compact") {
    return (
      <section className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left"
        >
          <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600">
            <AlertTriangle size={13} className="shrink-0 text-amber-600" />
            <span className="truncate">{t("dash.carriedTitle", { count: total })}</span>
          </span>
          <ChevronDown size={14} className={cn("shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
        </button>
        {open ? (
          <ul className="m-0 max-h-52 list-none divide-y divide-slate-100 overflow-y-auto border-t border-slate-100 p-0">
            {ordered.map((item) => {
              const label = (
                <>
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-slate-800">{item.title}</span>
                    {item.meta ? <span className="text-slate-400"> · {item.meta}</span> : null}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold text-slate-500">{formatMonthLabel(item.month, locale)}</span>
                </>
              );
              const className = "flex items-center justify-between gap-3 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50";
              return (
                <li key={item.id}>
                  {item.onOpen ? (
                    <button type="button" onClick={item.onOpen} className={`${className} w-full cursor-pointer text-left`}>{label}</button>
                  ) : item.href ? (
                    <Link href={item.href} className={className}>{label}</Link>
                  ) : (
                    <div className={className}>{label}</div>
                  )}
                </li>
              );
            })}
            {hidden > 0 ? <li className="px-3 py-1.5 text-[11px] font-semibold text-slate-500">{t("dash.carriedMore", { count: hidden })}</li> : null}
          </ul>
        ) : null}
      </section>
    );
  }

  return (
    <section className={cn("rounded-2xl border shadow-sm", hasLate ? "border-rose-300 bg-rose-50" : "border-amber-200 bg-amber-50/80")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white", hasLate ? "bg-rose-600" : "bg-amber-500")}>
          <AlertTriangle size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-black", hasLate ? "text-rose-950" : "text-amber-950")}>{t("dash.carriedTitle", { count: total })}</span>
          <span className={cn("mt-0.5 block text-xs leading-relaxed", hasLate ? "text-rose-900/80" : "text-amber-900/80")}>{t("dash.carriedHint")}</span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 transition-transform", hasLate ? "text-rose-700" : "text-amber-800", open && "rotate-180")} />
      </button>
      {open && ordered.length > 0 ? (
        <ul className="mx-4 mb-4 flex max-h-96 list-none flex-col gap-2 overflow-y-auto p-0">
          {ordered.map((item) => {
            const inner = (
              <>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-slate-900">{item.title}</span>
                    {item.late ? (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white uppercase">{t("dash.carriedLate")}</span>
                    ) : null}
                  </span>
                  {item.meta ? <span className="block truncate text-[11px] font-medium text-slate-500">{item.meta}</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={cn("rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold", item.late ? "border-rose-200 text-rose-700" : "border-amber-200 text-amber-800")}>
                    {formatMonthLabel(item.month, locale)}
                  </span>
                  <span className={cn("text-[11px] font-bold", item.late ? "text-rose-700" : "text-amber-800")}>{t("dash.carriedOpen")}</span>
                </span>
              </>
            );
            const className = cn(
              "flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors",
              item.late ? "border-rose-200 shadow-sm hover:border-rose-400" : "border-amber-100 hover:border-amber-300",
            );
            return (
              <li key={item.id}>
                {item.onOpen ? (
                  <button type="button" onClick={item.onOpen} className={`${className} w-full cursor-pointer`}>{inner}</button>
                ) : item.href ? (
                  <Link href={item.href} className={className}>{inner}</Link>
                ) : (
                  <div className={className}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && hidden > 0 ? <p className={cn("mx-4 mb-4 mt-0 text-xs font-bold", hasLate ? "text-rose-900" : "text-amber-900")}>{t("dash.carriedMore", { count: hidden })}</p> : null}
    </section>
  );
}
