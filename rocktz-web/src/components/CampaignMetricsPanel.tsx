"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, BarChart3, Clapperboard, Download, ExternalLink, Instagram, RefreshCw, Search, Trophy, Youtube } from "lucide-react";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { moneyCurrency } from "@/lib/geo";
import { mediaDownloadUrl } from "@/lib/media-playback";
import { usePrivacy } from "@/lib/privacy";
import { safeHttpUrl } from "@/lib/safe-http-url";
import type { Campaign, CampaignCreator, PostMetrics } from "@/lib/types";

export type PostMetricsRow = {
  id: number;
  creator?: { artistic_name?: string | null; full_name?: string | null; photo_url?: string | null } | null;
  published_link: string | null;
  metrics?: PostMetrics | null;
  subtitle?: string | null;
  networkHint?: string | null;
  videoDownloadUrl?: string | null;
  cost?: number | null;
  costKey?: string | number | null;
};

type PanelProps = {
  rows: PostMetricsRow[];
  locale: string;
  formatNumber: (value: number) => string;
  syncing: "all" | number | null;
  onRefresh: (rowId?: number) => void;
  headerExtra?: ReactNode;
  emptyLabel?: string;
  emptyHint?: string;
  currency?: string | null;
};

type CampaignProps = {
  campaign: Campaign;
  rows: CampaignCreator[];
  locale: string;
  formatNumber: (value: number) => string;
  onCampaign: (campaign: Campaign) => void;
};

type SortKey = "name" | "views" | "likes" | "comments" | "engagement" | "cpm";
type SortDir = "asc" | "desc";
type CpmIndex = Map<number, number | null>;

function asMetrics(value: PostMetrics | null | undefined): PostMetrics {
  if (!value || typeof value !== "object") return {};
  return value;
}

function metricNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function postNetwork(row: PostMetricsRow): string {
  const metrics = asMetrics(row.metrics);
  if (typeof metrics.network === "string" && metrics.network) return metrics.network;
  const link = row.published_link || "";
  if (/instagram\.com/i.test(link)) return "instagram";
  if (/tiktok\.com/i.test(link)) return "tiktok";
  if (/youtube\.com|youtu\.be/i.test(link)) return "youtube";
  return row.networkHint || "";
}

function rowName(row: PostMetricsRow): string {
  return `${row.creator?.artistic_name || ""} ${row.creator?.full_name || ""} ${row.subtitle || ""}`.trim();
}

function rowMetric(row: PostMetricsRow, key: Exclude<SortKey, "name">, cpmIndex?: CpmIndex): number | null {
  if (key === "cpm") return cpmIndex?.get(row.id) ?? null;
  return metricNumber(asMetrics(row.metrics)[key]);
}

function performanceKey(key: SortKey): Exclude<SortKey, "name"> {
  return key === "name" ? "views" : key;
}

function defaultSortDir(key: SortKey): SortDir {
  return key === "name" || key === "cpm" ? "asc" : "desc";
}

function compareByMetric(a: PostMetricsRow, b: PostMetricsRow, key: Exclude<SortKey, "name">, dir: SortDir, cpmIndex?: CpmIndex): number {
  const av = rowMetric(a, key, cpmIndex);
  const bv = rowMetric(b, key, cpmIndex);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  const cmp = av - bv;
  return dir === "asc" ? cmp : -cmp;
}

function topRows(rows: PostMetricsRow[], key: SortKey, limit: number, cpmIndex?: CpmIndex): PostMetricsRow[] {
  const metric = performanceKey(key);
  return [...rows].sort((a, b) => compareByMetric(a, b, metric, defaultSortDir(metric), cpmIndex)).slice(0, limit);
}

function spendKey(row: PostMetricsRow): string {
  if (row.costKey != null && row.costKey !== "") return String(row.costKey);
  return `row:${row.id}`;
}

function influencerCpmIndex(rows: PostMetricsRow[]): CpmIndex {
  const spend = new Map<string, { cost: number; views: number }>();
  for (const row of rows) {
    const key = spendKey(row);
    const current = spend.get(key) ?? { cost: 0, views: 0 };
    current.cost = Math.max(current.cost, metricNumber(row.cost) ?? 0);
    current.views += metricNumber(asMetrics(row.metrics).views) ?? 0;
    spend.set(key, current);
  }

  const index: CpmIndex = new Map();
  for (const row of rows) {
    const group = spend.get(spendKey(row));
    const cost = group?.cost ?? 0;
    const views = group?.views ?? 0;
    index.set(row.id, cost > 0 && views > 0 ? (cost / views) * 1000 : null);
  }
  return index;
}

type MetricTotals = {
  posts: number;
  likes: number;
  comments: number;
  views: number;
  engagement: number | null;
  synced: number;
  cost: number;
  cpm: number | null;
};

const NETWORKS = ["instagram", "tiktok", "youtube"] as const;

function totalsFromRows(rows: PostMetricsRow[]): MetricTotals {
  let likes = 0;
  let comments = 0;
  let views = 0;
  let engagementSum = 0;
  let engagementCount = 0;
  let synced = 0;
  const costs = new Map<string, number>();

  for (const row of rows) {
    const metrics = asMetrics(row.metrics);
    likes += metricNumber(metrics.likes) ?? 0;
    comments += metricNumber(metrics.comments) ?? 0;
    views += metricNumber(metrics.views) ?? 0;
    const engagement = metricNumber(metrics.engagement);
    if (engagement != null) {
      engagementSum += engagement;
      engagementCount += 1;
    }
    if (metrics.synced_at) synced += 1;
    costs.set(spendKey(row), Math.max(costs.get(spendKey(row)) ?? 0, metricNumber(row.cost) ?? 0));
  }

  const cost = [...costs.values()].reduce((sum, value) => sum + value, 0);

  return {
    posts: rows.length,
    likes,
    comments,
    views,
    engagement: engagementCount ? engagementSum / engagementCount : null,
    synced,
    cost,
    cpm: cost > 0 && views > 0 ? (cost / views) * 1000 : null,
  };
}

function formatEngagement(value: number | null, locale: string): string {
  if (value == null) return "—";
  return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
}

function formatSyncedAt(value: number | null | undefined, locale: string, neverLabel: string): string {
  if (!value) return neverLabel;
  return new Date(value * 1000).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

function videoHref(url?: string | null): string | undefined {
  const raw = url?.trim();
  if (!raw) return undefined;
  return safeHttpUrl(mediaDownloadUrl(raw));
}

export function PostMetricsPanel({
  rows,
  locale,
  formatNumber,
  syncing,
  onRefresh,
  headerExtra,
  emptyLabel,
  emptyHint,
  currency,
}: PanelProps) {
  const { t } = useTranslation("app");
  const { formatCurrency } = usePrivacy();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [networkFilter, setNetworkFilter] = useState("");

  const linked = useMemo(() => rows.filter((row) => Boolean(row.published_link?.trim())), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (networkFilter && postNetwork(row) !== networkFilter) return false;
      if (!term) return true;
      return rowName(row).toLowerCase().includes(term);
    });
  }, [rows, query, networkFilter]);

  const visibleLinked = useMemo(() => filtered.filter((row) => Boolean(row.published_link?.trim())), [filtered]);
  const cpmIndex = useMemo(() => influencerCpmIndex(visibleLinked), [visibleLinked]);
  const linkedCpmIndex = useMemo(() => influencerCpmIndex(linked), [linked]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "name") {
        const cmp = rowName(a).localeCompare(rowName(b), locale, { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      }
      return compareByMetric(a, b, sortKey, sortDir, cpmIndex);
    });
    return copy;
  }, [cpmIndex, filtered, locale, sortDir, sortKey]);

  const bestByPlatform = useMemo(
    () =>
      NETWORKS.map((network) => {
        const networkRows = linked.filter((row) => postNetwork(row) === network);
        const networkCpmIndex = influencerCpmIndex(networkRows);
        return {
          network,
          cpmIndex: networkCpmIndex,
          rows: topRows(networkRows, sortKey, 3, networkCpmIndex),
        };
      }).filter((item) => item.rows.length > 0),
    [linked, sortKey],
  );

  const totals = useMemo(() => totalsFromRows(visibleLinked), [visibleLinked]);
  const byNetwork = useMemo(
    () =>
      NETWORKS.map((network) => ({
        network,
        totals: totalsFromRows(linked.filter((row) => postNetwork(row) === network)),
      })).filter((item) => item.totals.posts > 0),
    [linked],
  );

  function networkLabel(network: string) {
    if (network === "instagram") return t("campaignDetail.networkInstagram");
    if (network === "tiktok") return t("campaignDetail.networkTikTok");
    if (network === "youtube") return t("campaignDetail.networkYouTube");
    return t("campaignDetail.networkUnknown");
  }

  function applySort(key: SortKey, toggle = true) {
    if (toggle && sortKey === key) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir(defaultSortDir(key));
  }

  const sortOptions = [
    { value: "views", label: t("campaignDetail.metricsSortViews") },
    { value: "likes", label: t("campaignDetail.metricsSortLikes") },
    { value: "comments", label: t("campaignDetail.metricsSortComments") },
    { value: "engagement", label: t("campaignDetail.metricsSortEngagement") },
    { value: "cpm", label: t("campaignDetail.metricsSortCpm") },
    { value: "name", label: t("campaignDetail.metricsSortName") },
  ];

  const platformOptions = [
    { value: "all", label: t("campaignDetail.metricsPlatformAll") },
    ...NETWORKS.filter((network) => linked.some((row) => postNetwork(row) === network)).map((network) => ({
      value: network,
      label: networkLabel(network),
    })),
  ];

  function formatCpm(value: number | null): string {
    if (value == null) return "—";
    return formatCurrency(value, currency);
  }

  function formatRowMetric(row: PostMetricsRow, key: SortKey, index: CpmIndex = linkedCpmIndex): string {
    const metric = performanceKey(key);
    const value = rowMetric(row, metric, index);
    if (value == null) return "—";
    if (metric === "engagement") return formatEngagement(value, locale);
    if (metric === "cpm") return formatCpm(value);
    return formatNumber(value);
  }

  function metricLabel(key: SortKey): string {
    const metric = performanceKey(key);
    if (metric === "likes") return t("campaignDetail.colLikes");
    if (metric === "comments") return t("campaignDetail.colComments");
    if (metric === "engagement") return t("campaignDetail.colEngagement");
    if (metric === "cpm") return t("campaignDetail.colCpm");
    return t("campaignDetail.colViews");
  }

  const kpis = [
    { key: "views" as const, label: t("campaignDetail.kpiPostViews"), value: formatNumber(totals.views) },
    { key: "likes" as const, label: t("campaignDetail.kpiLikes"), value: formatNumber(totals.likes) },
    { key: "comments" as const, label: t("campaignDetail.kpiComments"), value: formatNumber(totals.comments) },
    { key: "engagement" as const, label: t("campaignDetail.kpiPostEngagement"), value: formatEngagement(totals.engagement, locale) },
    { key: "cpm" as const, label: t("campaignDetail.kpiCpm"), value: formatCpm(totals.cpm), hint: t("campaignDetail.kpiCpmHint") },
  ];

  const SortIcon = sortDir === "desc" ? ArrowDownWideNarrow : ArrowUpNarrowWide;

  function SortHeader({ label, column }: { label: string; column: SortKey }) {
    const active = sortKey === column;
    return (
      <th className="px-4 py-3">
        <button
          type="button"
          onClick={() => applySort(column)}
          className={cn(
            "inline-flex items-center gap-1 tracking-wider uppercase",
            active ? "text-indigo-700" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {label}
          {active ? <SortIcon size={12} /> : null}
        </button>
      </th>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <BarChart3 size={18} className="text-brand-primary" />
              {t("campaignDetail.metricsTitle")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{emptyHint || t("campaignDetail.metricsHint")}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {headerExtra}
            <button
              type="button"
              disabled={syncing !== null}
              onClick={() => onRefresh()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-[11px] font-black tracking-wider text-white uppercase shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn(syncing === "all" && "animate-spin")} />
              {syncing === "all" ? t("campaignDetail.metricsRefreshing") : t("campaignDetail.metricsRefresh")}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.metricsSearchLabel")}</span>
            <span className="relative block">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("campaignDetail.metricsSearchPh")}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-purple-600"
              />
            </span>
          </label>
          <div className="w-full lg:w-56">
            <p className="mb-1.5 text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.metricsPlatformLabel")}</p>
            <Select2Field
              theme="light"
              searchable={false}
              value={networkFilter || "all"}
              options={platformOptions}
              onChange={(value) => setNetworkFilter(value === "all" ? "" : value)}
            />
          </div>
          <div className="w-full lg:w-64">
            <p className="mb-1.5 text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.metricsSortBy")}</p>
            <Select2Field
              theme="light"
              searchable={false}
              value={sortKey}
              options={sortOptions}
              onChange={(value) => {
                const next = value as SortKey;
                setSortKey(next);
                setSortDir(defaultSortDir(next));
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.metricsOverall")}</p>
          <p className="text-[11px] text-slate-400">{t("campaignDetail.metricsSortHint")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.kpiPosts")}</p>
              <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(totals.posts)}</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-400">{t("campaignDetail.kpiPostsHint", { count: totals.synced })}</p>
            </div>
            {kpis.map((kpi) => {
              const active = sortKey === kpi.key;
              return (
                <button
                  key={kpi.key}
                  type="button"
                  onClick={() => applySort(kpi.key)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-colors",
                    active ? "border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200" : "border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-white",
                  )}
                >
                  <p className={cn("flex items-center gap-1 text-[10px] font-black tracking-wider uppercase", active ? "text-indigo-700" : "text-slate-500")}>
                    {kpi.label}
                    {active ? <SortIcon size={12} /> : null}
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">{kpi.value}</p>
                  {"hint" in kpi && kpi.hint ? <p className="mt-0.5 text-[10px] font-medium text-slate-400">{kpi.hint}</p> : null}
                </button>
              );
            })}
          </div>
        </div>

        {byNetwork.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.metricsByNetwork")}</p>
            <div className={cn("grid gap-3", byNetwork.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")}>
              {byNetwork.map(({ network, totals: networkTotals }) => {
                const Icon = network === "instagram" ? Instagram : network === "youtube" ? Youtube : Clapperboard;
                const iconClass = network === "instagram" ? "text-pink-500" : network === "youtube" ? "text-red-600" : "text-rose-500";
                const active = networkFilter === network;
                const stats = [
                  { key: "views" as const, label: t("campaignDetail.kpiPostViews"), value: formatNumber(networkTotals.views) },
                  { key: "likes" as const, label: t("campaignDetail.kpiLikes"), value: formatNumber(networkTotals.likes) },
                  { key: "comments" as const, label: t("campaignDetail.kpiComments"), value: formatNumber(networkTotals.comments) },
                  { key: "engagement" as const, label: t("campaignDetail.kpiPostEngagement"), value: formatEngagement(networkTotals.engagement, locale) },
                  { key: "cpm" as const, label: t("campaignDetail.kpiCpm"), value: formatCpm(networkTotals.cpm) },
                ];

                return (
                  <div
                    key={network}
                    className={cn("rounded-2xl border p-4", active ? "border-indigo-300 bg-indigo-50/70" : "border-slate-100 bg-slate-50")}
                  >
                    <button type="button" onClick={() => setNetworkFilter((current) => (current === network ? "" : network))} className="mb-3 flex w-full items-center gap-2 text-left">
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-xs", iconClass)}>
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">{networkLabel(network)}</p>
                        <p className="text-[10px] font-medium text-slate-400">
                          {active ? t("campaignDetail.metricsNetworkClear") : t("campaignDetail.kpiPostsHint", { count: networkTotals.synced })}
                        </p>
                      </div>
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase">{t("campaignDetail.kpiPosts")}</p>
                        <p className="mt-0.5 text-sm font-black text-slate-900">{formatNumber(networkTotals.posts)}</p>
                      </div>
                      {stats.map((stat) => (
                        <button
                          key={stat.key}
                          type="button"
                          onClick={() => {
                            setNetworkFilter(network);
                            applySort(stat.key, false);
                          }}
                          className={cn(
                            "rounded-xl bg-white px-3 py-2 text-left hover:ring-2 hover:ring-indigo-200",
                            active && sortKey === stat.key && "ring-2 ring-indigo-300",
                          )}
                        >
                          <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase">{stat.label}</p>
                          <p className="mt-0.5 text-sm font-black text-slate-900">{stat.value}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {bestByPlatform.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-slate-500 uppercase">
                <Trophy size={12} className="text-amber-500" />
                {t("campaignDetail.metricsBestByPlatform")}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">{t("campaignDetail.metricsBestByPlatformHint", { metric: metricLabel(sortKey) })}</p>
            </div>
            <div className={cn("grid gap-3", bestByPlatform.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")}>
              {bestByPlatform.map(({ network, rows: winners, cpmIndex: networkCpmIndex }) => {
                const Icon = network === "instagram" ? Instagram : network === "youtube" ? Youtube : Clapperboard;
                const iconClass = network === "instagram" ? "text-pink-500" : network === "youtube" ? "text-red-600" : "text-rose-500";
                const active = networkFilter === network;

                return (
                  <div key={network} className={cn("rounded-2xl border p-4", active ? "border-amber-300 bg-amber-50/60" : "border-slate-100 bg-slate-50")}>
                    <button
                      type="button"
                      onClick={() => {
                        setNetworkFilter((current) => (current === network ? "" : network));
                        applySort(performanceKey(sortKey), false);
                      }}
                      className="mb-3 flex w-full items-center gap-2 text-left"
                    >
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-xs", iconClass)}>
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">{networkLabel(network)}</p>
                        <p className="text-[10px] font-medium text-slate-400">{t("campaignDetail.metricsBestSeeAll")}</p>
                      </div>
                    </button>
                    <ol className="flex flex-col gap-2">
                      {winners.map((row, index) => {
                        const name = row.creator?.artistic_name || row.creator?.full_name || "";
                        const link = row.published_link?.trim() || "";
                        const href = link ? safeHttpUrl(link) : undefined;
                        return (
                          <li key={row.id}>
                            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setNetworkFilter(network);
                                  applySort(performanceKey(sortKey), false);
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black", index === 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}>
                                  {index + 1}
                                </span>
                                <UserAvatar src={row.creator?.photo_url} name={name} size="custom" shape="rounded-lg" className="h-7 w-7 border border-slate-200" textClassName="text-[10px]" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-bold text-slate-900">@{row.creator?.artistic_name || name}</span>
                                  {row.subtitle ? <span className="block truncate text-[10px] font-medium text-slate-400">{row.subtitle}</span> : null}
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block text-xs font-black text-slate-900">{formatRowMetric(row, sortKey, networkCpmIndex)}</span>
                                  <span className="block text-[9px] font-bold tracking-wider text-slate-400 uppercase">{metricLabel(sortKey)}</span>
                                </span>
                              </button>
                              {href ? (
                                <a href={href} target="_blank" rel="noreferrer" className="shrink-0 text-slate-400 hover:text-emerald-700" aria-label={t("campaignDetail.openPost")}>
                                  <ExternalLink size={14} />
                                </a>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black tracking-wider text-slate-500 uppercase">
                <SortHeader label={t("campaignDetail.colCreator")} column="name" />
                <th className="px-4 py-3">{t("campaignDetail.colNetwork")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colLink")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colVideo")}</th>
                <SortHeader label={t("campaignDetail.colViews")} column="views" />
                <SortHeader label={t("campaignDetail.colLikes")} column="likes" />
                <SortHeader label={t("campaignDetail.colComments")} column="comments" />
                <SortHeader label={t("campaignDetail.colEngagement")} column="engagement" />
                <SortHeader label={t("campaignDetail.colCpm")} column="cpm" />
                <th className="px-4 py-3">{t("campaignDetail.colSynced")}</th>
                <th className="px-4 py-3 text-right">{t("campaignDetail.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    {emptyLabel || t("campaignDetail.noCreatorHint")}
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    {t("campaignDetail.metricsNoResults")}
                  </td>
                </tr>
              ) : (
                sorted.map((row) => {
                  const metrics = asMetrics(row.metrics);
                  const link = row.published_link?.trim() || "";
                  const network = postNetwork(row);
                  const name = row.creator?.artistic_name || row.creator?.full_name || "";
                  const download = videoHref(row.videoDownloadUrl);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <UserAvatar src={row.creator?.photo_url} name={name} size="custom" shape="rounded-lg" className="h-7 w-7 border border-slate-200" textClassName="text-[10px]" />
                          <div className="min-w-0">
                            <span>@{row.creator?.artistic_name || name}</span>
                            {row.subtitle ? <p className="truncate text-[10px] font-medium text-slate-400">{row.subtitle}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{network ? networkLabel(network) : "—"}</td>
                      <td className="px-4 py-3.5">
                        {link ? (
                          <a href={safeHttpUrl(link)} target="_blank" rel="noreferrer" className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs font-bold text-emerald-700 hover:underline">
                            {t("campaignDetail.openPost")} <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">{t("campaignDetail.metricsNoLink")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {download ? (
                          <a
                            href={download}
                            download
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
                          >
                            <Download size={12} /> {t("campaignDetail.downloadSubmittedVideo")}
                          </a>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-black text-slate-900">{metricNumber(metrics.views) != null ? formatNumber(metricNumber(metrics.views) ?? 0) : "—"}</td>
                      <td className="px-4 py-3.5 font-black text-slate-900">{metricNumber(metrics.likes) != null ? formatNumber(metricNumber(metrics.likes) ?? 0) : "—"}</td>
                      <td className="px-4 py-3.5 font-black text-slate-900">{metricNumber(metrics.comments) != null ? formatNumber(metricNumber(metrics.comments) ?? 0) : "—"}</td>
                      <td className="px-4 py-3.5 font-black text-slate-900">{formatEngagement(metricNumber(metrics.engagement), locale)}</td>
                      <td className="px-4 py-3.5 font-black text-slate-900">{formatCpm(cpmIndex.get(row.id) ?? null)}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-500">{formatSyncedAt(metricNumber(metrics.synced_at) ?? undefined, locale, t("campaignDetail.neverSynced"))}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          disabled={!link || syncing !== null}
                          onClick={() => onRefresh(row.id)}
                          title={t("campaignDetail.metricsRefreshRow")}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black tracking-wider text-slate-600 uppercase hover:bg-slate-50 disabled:opacity-40"
                        >
                          <RefreshCw size={12} className={cn(syncing === row.id && "animate-spin")} />
                          {t("campaignDetail.metricsRefreshRow")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CampaignMetricsPanel({ campaign, rows, locale, formatNumber, onCampaign }: CampaignProps) {
  const { t } = useTranslation("app");
  const [syncing, setSyncing] = useState<"all" | number | null>(null);

  const mapped = useMemo<PostMetricsRow[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        creator: row.creator,
        published_link: row.content?.published_link ?? null,
        metrics: row.content?.metrics,
        cost: campaign.is_barter || campaign.is_direct_contract ? 0 : Number(row.amount) || Number(campaign.creator_cache) || 0,
        costKey: row.creator_id || row.id,
        videoDownloadUrl:
          row.video_status === "approved"
            ? row.content?.video_download_url || row.content?.video_url || null
            : null,
      })),
    [campaign.creator_cache, campaign.is_barter, campaign.is_direct_contract, rows],
  );

  async function refresh(campaignCreatorId?: number) {
    if (!mapped.some((row) => row.published_link?.trim())) {
      await alertWarning(t("campaignDetail.metricsEmpty"), t("campaignDetail.metricsEmptyHint"));
      return;
    }

    setSyncing(campaignCreatorId ?? "all");
    try {
      const response = await api.syncCampaignPostMetrics(campaign.id, {
        campaign_creator_id: campaignCreatorId,
      });
      if (!response.data) {
        return;
      }
      onCampaign(response.data);
      const failed = Object.values(response.sync ?? {}).filter((item) => !item.ok);
      if (failed.length > 0) {
        await alertWarning(
          t("campaignDetail.metricsPartialTitle"),
          failed[0]?.message || t("campaignDetail.metricsPartialHint", { count: failed.length }),
        );
      } else {
        await alertSuccess(t("campaignDetail.metricsUpdated"));
      }
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSyncing(null);
    }
  }

  return (
    <PostMetricsPanel
      rows={mapped}
      locale={locale}
      formatNumber={formatNumber}
      syncing={syncing}
      onRefresh={(rowId) => void refresh(rowId)}
      currency={moneyCurrency(campaign)}
    />
  );
}
