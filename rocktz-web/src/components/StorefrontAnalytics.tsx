"use client";

import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/ui/PageHeader";
import type { StorefrontStats } from "@/lib/types";

export function StorefrontAnalytics({ stats, showIntro = true }: { stats: StorefrontStats; showIntro?: boolean }) {
  const { t, i18n } = useTranslation("app");
  const max = Math.max(1, ...stats.days.map((day) => Math.max(day.views, day.clicks)));
  const numberLocale = i18n.language === "en" ? "en" : i18n.language === "es" ? "es" : "pt-BR";

  return (
    <div className="space-y-5">
      {showIntro ? (
        <div>
          <h4 className="text-sm font-bold text-slate-900">{t("storefront.statsTitle")}</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t("storefront.statsHint")}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("storefront.statsViews")} value={stats.views.toLocaleString(numberLocale)} />
        <StatCard label={t("storefront.statsVisitors")} value={stats.unique_visitors.toLocaleString(numberLocale)} />
        <StatCard label={t("storefront.statsClicks")} value={stats.clicks.toLocaleString(numberLocale)} />
        <StatCard label={t("storefront.statsCtr")} value={`${stats.ctr.toLocaleString(numberLocale)}%`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard label={t("storefront.statsLikes")} value={stats.likes.toLocaleString(numberLocale)} />
        <StatCard label={t("storefront.statsShares")} value={stats.shares.toLocaleString(numberLocale)} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("storefront.statsLastDays")}</p>
        <div className="flex h-36 items-end gap-1">
          {stats.days.map((day) => (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-0.5">
                <div className="w-1.5 rounded-t bg-slate-300" style={{ height: `${Math.max(6, (day.views / max) * 100)}%` }} title={`${day.views}`} />
                <div className="w-1.5 rounded-t bg-brand-primary" style={{ height: `${Math.max(6, (day.clicks / max) * 100)}%` }} title={`${day.clicks}`} />
              </div>
              <span className="text-[9px] font-bold text-slate-400">
                {new Date(`${day.date}T12:00:00`).toLocaleDateString(numberLocale, { day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-[10px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-300" /> {t("storefront.statsViews")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand-primary" /> {t("storefront.statsClicks")}</span>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("storefront.statsTopItems")}</p>
        {stats.items.length === 0 ? (
          <p className="text-xs text-slate-500">{t("storefront.statsEmptyItems")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stats.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="truncate font-semibold text-slate-800">{item.title}</span>
                <span className="shrink-0 text-xs font-bold text-brand-primary">{t("storefront.itemClicks", { count: item.clicks })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
