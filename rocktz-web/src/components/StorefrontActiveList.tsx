"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { BarChart3, Copy, ExternalLink, Search } from "lucide-react";
import { CountrySelect } from "@/components/GeoSelectFields";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess } from "@/lib/alerts";
import { formatLocation, normalizeCountry } from "@/lib/geo";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import type { StorefrontOverviewRow } from "@/lib/types";

const FILTER_TRIGGER =
  "h-[42px] rounded-lg border-[#E2E8F0] bg-[#F9FAFB] px-4 text-xs font-bold tracking-wide text-[#64748B] uppercase";

type SourceFilter = "all" | "admin" | "campaigns";
type ItemsFilter = "all" | "with" | "empty";
type SortKey = "views" | "clicks" | "likes" | "name" | "items";

export function StorefrontActiveList() {
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));
  const [rows, setRows] = useState<StorefrontOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [items, setItems] = useState<ItemsFilter>("all");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<SortKey>("views");

  useEffect(() => {
    api.storefrontOverview()
      .then((res) => setRows(res.data))
      .catch(alertApiError)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = rows.filter((row) => {
      const matchesSearch =
        !term ||
        row.artistic_name.toLowerCase().includes(term) ||
        (row.slug || "").toLowerCase().includes(term) ||
        row.public_url.toLowerCase().includes(term);
      const matchesSource =
        source === "all" ||
        (source === "admin" && row.enabled_by_admin) ||
        (source === "campaigns" && !row.enabled_by_admin);
      const matchesItems =
        items === "all" ||
        (items === "with" && row.published_items > 0) ||
        (items === "empty" && row.published_items === 0);
      const matchesCountry = country === "all" || normalizeCountry(row.country) === country;
      return matchesSearch && matchesSource && matchesItems && matchesCountry;
    });

    return [...list].sort((a, b) => {
      if (sort === "name") return a.artistic_name.localeCompare(b.artistic_name, locale);
      if (sort === "items") return b.published_items - a.published_items;
      if (sort === "clicks") return b.clicks - a.clicks;
      if (sort === "likes") return b.likes - a.likes;
      return b.views - a.views;
    });
  }, [rows, search, source, items, country, sort, locale]);

  const totals = useMemo(
    () => ({
      total: filtered.length,
      views: filtered.reduce((sum, row) => sum + row.views, 0),
      clicks: filtered.reduce((sum, row) => sum + row.clicks, 0),
      likes: filtered.reduce((sum, row) => sum + row.likes, 0),
    }),
    [filtered],
  );

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    await alertSuccess(t("storefront.linkCopied"));
  }

  const number = (value: number) => value.toLocaleString(locale);

  return (
    <section className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-950">{t("storefront.activeTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("storefront.activeSubtitle")}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label={t("storefront.activeCount")} value={number(totals.total)} />
        <SummaryCard label={t("storefront.statsViews")} value={number(totals.views)} />
        <SummaryCard label={t("storefront.statsClicks")} value={number(totals.clicks)} />
        <SummaryCard label={t("storefront.statsLikes")} value={number(totals.likes)} />
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("storefront.activeSearch")}
            className="w-full rounded-lg border border-[#E2E8F0] py-2.5 pr-4 pl-10 text-sm outline-none transition-all focus:border-brand-primary"
          />
        </div>
        <div className="flex w-full flex-wrap gap-2 lg:w-auto">
          <Select2Field
            theme="light"
            searchable={false}
            value={source}
            options={[
              { value: "all", label: t("storefront.filterSourceAll") },
              { value: "admin", label: t("storefront.filterSourceAdmin") },
              { value: "campaigns", label: t("storefront.filterSourceCampaigns") },
            ]}
            onChange={(value) => setSource(value as SourceFilter)}
            className="min-w-[180px] flex-1 lg:w-48 lg:flex-none"
            triggerClassName={FILTER_TRIGGER}
          />
          <Select2Field
            theme="light"
            searchable={false}
            value={items}
            options={[
              { value: "all", label: t("storefront.filterItemsAll") },
              { value: "with", label: t("storefront.filterItemsWith") },
              { value: "empty", label: t("storefront.filterItemsEmpty") },
            ]}
            onChange={(value) => setItems(value as ItemsFilter)}
            className="min-w-[180px] flex-1 lg:w-48 lg:flex-none"
            triggerClassName={FILTER_TRIGGER}
          />
          <CountrySelect
            theme="light"
            value={country}
            emptyLabel={t("storefront.filterCountryAll")}
            onChange={setCountry}
            className="min-w-[180px] flex-1 lg:w-48 lg:flex-none"
            triggerClassName={FILTER_TRIGGER}
          />
          <Select2Field
            theme="light"
            searchable={false}
            value={sort}
            options={[
              { value: "views", label: t("storefront.sortViews") },
              { value: "clicks", label: t("storefront.sortClicks") },
              { value: "likes", label: t("storefront.sortLikes") },
              { value: "items", label: t("storefront.sortItems") },
              { value: "name", label: t("storefront.sortName") },
            ]}
            onChange={(value) => setSort(value as SortKey)}
            className="min-w-[180px] flex-1 lg:w-48 lg:flex-none"
            triggerClassName={FILTER_TRIGGER}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t("storefront.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("storefront.activeEmpty")}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-black tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">{t("storefront.colCreator")}</th>
                  <th className="px-4 py-3">{t("storefront.colUrl")}</th>
                  <th className="px-4 py-3">{t("storefront.colSource")}</th>
                  <th className="px-4 py-3 text-right">{t("storefront.colItems")}</th>
                  <th className="px-4 py-3 text-right">{t("storefront.statsViews")}</th>
                  <th className="px-4 py-3 text-right">{t("storefront.statsClicks")}</th>
                  <th className="px-4 py-3 text-right">{t("storefront.statsCtr")}</th>
                  <th className="px-4 py-3 text-right">{t("storefront.statsLikes")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar src={row.photo_url} name={row.artistic_name} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/creators/${row.id}?tab=storefront`} className="block truncate font-bold text-slate-900 hover:text-brand-primary">
                            @{row.artistic_name}
                          </Link>
                          <p className="truncate text-[11px] text-slate-400">{formatLocation(locale, row) || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[240px] items-center gap-1.5">
                        <a href={row.public_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-semibold text-violet-700 hover:underline">
                          {row.public_url}
                        </a>
                        <button type="button" onClick={() => void copyUrl(row.public_url)} title={t("storefront.copyLink")} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-violet-50 hover:text-violet-700">
                          <Copy size={13} />
                          <span className="sr-only">{t("storefront.copyLink")}</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SourceChip admin={row.enabled_by_admin} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{number(row.published_items)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{number(row.views)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{number(row.clicks)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{number(row.ctr)}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{number(row.likes)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <a href={row.public_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title={t("storefront.viewPublic")}>
                          <ExternalLink size={14} />
                        </a>
                        <Link href={`/creators/${row.id}?tab=storefront-metrics`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" title={t("storefront.viewMetrics")}>
                          <BarChart3 size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col divide-y divide-slate-100 md:hidden">
            {filtered.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar src={row.photo_url} name={row.artistic_name} size="sm" />
                    <div className="min-w-0">
                      <Link href={`/creators/${row.id}?tab=storefront`} className="block truncate font-bold text-slate-900">
                        @{row.artistic_name}
                      </Link>
                      <p className="truncate text-[11px] text-slate-400">{formatLocation(locale, row) || "—"}</p>
                    </div>
                  </div>
                  <SourceChip admin={row.enabled_by_admin} />
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <a href={row.public_url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs font-semibold text-violet-700">
                    {row.public_url}
                  </a>
                  <button type="button" onClick={() => void copyUrl(row.public_url)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-violet-50">
                    <Copy size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <MiniStat label={t("storefront.colItems")} value={number(row.published_items)} />
                  <MiniStat label={t("storefront.statsViews")} value={number(row.views)} />
                  <MiniStat label={t("storefront.statsClicks")} value={number(row.clicks)} />
                  <MiniStat label={t("storefront.statsLikes")} value={number(row.likes)} />
                </div>
                <div className="flex gap-2">
                  <a href={row.public_url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[11px] font-bold text-slate-700">
                    <ExternalLink size={13} /> {t("storefront.viewPublic")}
                  </a>
                  <Link href={`/creators/${row.id}?tab=storefront-metrics`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 py-2 text-[11px] font-bold text-violet-700">
                    <BarChart3 size={13} /> {t("storefront.viewMetrics")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function SourceChip({ admin }: { admin: boolean }) {
  const { t } = useTranslation("app");
  return (
    <span
      className={
        admin
          ? "inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-violet-800 uppercase"
          : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-800 uppercase"
      }
    >
      {admin ? t("storefront.sourceAdmin") : t("storefront.sourceCampaigns")}
    </span>
  );
}
