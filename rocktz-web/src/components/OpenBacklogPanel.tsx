"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { formatMonthLabel } from "@/components/MonthScopeBar";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import type { OpenBacklogEntry } from "@/lib/open-demands";

export function OpenBacklogPanel({ items, count }: { items: OpenBacklogEntry[]; count?: number }) {
  const { t, i18n } = useTranslation("app");
  const total = count ?? items.length;
  if (total < 1) return null;
  const locale = intlLocale(normalizeLocale(i18n.language));
  const hidden = Math.max(0, total - items.length);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
          <AlertTriangle size={16} />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-black text-amber-950">{t("dash.carriedTitle", { count: total })}</h3>
          <p className="mt-0.5 mb-0 text-xs leading-relaxed text-amber-900/80">{t("dash.carriedHint")}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 flex list-none flex-col gap-2 p-0">
          {items.map((item) => {
            const inner = (
              <>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">{item.title}</span>
                  {item.meta ? <span className="block truncate text-[11px] font-medium text-slate-500">{item.meta}</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                    {formatMonthLabel(item.month, locale)}
                  </span>
                  <span className="text-[11px] font-bold text-amber-800">{t("dash.carriedOpen")}</span>
                </span>
              </>
            );
            const className = "flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-left transition-colors hover:border-amber-300";
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
      {hidden > 0 ? <p className="mt-2 mb-0 text-xs font-bold text-amber-900">{t("dash.carriedMore", { count: hidden })}</p> : null}
    </section>
  );
}
