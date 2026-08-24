"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Clapperboard, ExternalLink, Instagram, RefreshCw, Youtube } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { safeHttpUrl } from "@/lib/safe-http-url";
import type { Campaign, CampaignCreator, PostMetrics } from "@/lib/types";

export type PostMetricsRow = {
  id: number;
  creator?: { artistic_name?: string | null; full_name?: string | null; photo_url?: string | null } | null;
  published_link: string | null;
  metrics?: PostMetrics | null;
  subtitle?: string | null;
  networkHint?: string | null;
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
};

type CampaignProps = {
  campaign: Campaign;
  rows: CampaignCreator[];
  locale: string;
  formatNumber: (value: number) => string;
  onCampaign: (campaign: Campaign) => void;
};

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

type MetricTotals = {
  posts: number;
  likes: number;
  comments: number;
  views: number;
  engagement: number | null;
  synced: number;
};

const NETWORKS = ["instagram", "tiktok", "youtube"] as const;

function totalsFromRows(rows: PostMetricsRow[]): MetricTotals {
  let likes = 0;
  let comments = 0;
  let views = 0;
  let engagementSum = 0;
  let engagementCount = 0;
  let synced = 0;

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
  }

  return {
    posts: rows.length,
    likes,
    comments,
    views,
    engagement: engagementCount ? engagementSum / engagementCount : null,
    synced,
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

export function PostMetricsPanel({
  rows,
  locale,
  formatNumber,
  syncing,
  onRefresh,
  headerExtra,
  emptyLabel,
  emptyHint,
}: PanelProps) {
  const { t } = useTranslation("app");

  const linked = useMemo(() => rows.filter((row) => Boolean(row.published_link?.trim())), [rows]);
  const totals = useMemo(() => totalsFromRows(linked), [linked]);
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

  const kpis = [
    { key: "posts", label: t("campaignDetail.kpiPosts"), value: formatNumber(totals.posts), hint: t("campaignDetail.kpiPostsHint", { count: totals.synced }) },
    { key: "views", label: t("campaignDetail.kpiPostViews"), value: formatNumber(totals.views) },
    { key: "likes", label: t("campaignDetail.kpiLikes"), value: formatNumber(totals.likes) },
    { key: "comments", label: t("campaignDetail.kpiComments"), value: formatNumber(totals.comments) },
    { key: "engagement", label: t("campaignDetail.kpiPostEngagement"), value: formatEngagement(totals.engagement, locale) },
  ] as const;

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

        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.metricsOverall")}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {kpis.map((kpi) => (
              <div key={kpi.key} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{kpi.label}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{kpi.value}</p>
                {"hint" in kpi && kpi.hint ? <p className="mt-0.5 text-[10px] font-medium text-slate-400">{kpi.hint}</p> : null}
              </div>
            ))}
          </div>
        </div>

        {byNetwork.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.metricsByNetwork")}</p>
            <div className={cn("grid gap-3", byNetwork.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")}>
              {byNetwork.map(({ network, totals: networkTotals }) => {
                const Icon = network === "instagram" ? Instagram : network === "youtube" ? Youtube : Clapperboard;
                const iconClass = network === "instagram" ? "text-pink-500" : network === "youtube" ? "text-red-600" : "text-rose-500";
                const stats = [
                  { label: t("campaignDetail.kpiPosts"), value: formatNumber(networkTotals.posts) },
                  { label: t("campaignDetail.kpiPostViews"), value: formatNumber(networkTotals.views) },
                  { label: t("campaignDetail.kpiLikes"), value: formatNumber(networkTotals.likes) },
                  { label: t("campaignDetail.kpiComments"), value: formatNumber(networkTotals.comments) },
                  { label: t("campaignDetail.kpiPostEngagement"), value: formatEngagement(networkTotals.engagement, locale) },
                ];

                return (
                  <div key={network} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-xs", iconClass)}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <p className="text-sm font-black text-slate-900">{networkLabel(network)}</p>
                        <p className="text-[10px] font-medium text-slate-400">{t("campaignDetail.kpiPostsHint", { count: networkTotals.synced })}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {stats.map((stat) => (
                        <div key={stat.label} className="rounded-xl bg-white px-3 py-2">
                          <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase">{stat.label}</p>
                          <p className="mt-0.5 text-sm font-black text-slate-900">{stat.value}</p>
                        </div>
                      ))}
                    </div>
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
                <th className="px-4 py-3">{t("campaignDetail.colCreator")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colNetwork")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colLink")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colViews")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colLikes")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colComments")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colEngagement")}</th>
                <th className="px-4 py-3">{t("campaignDetail.colSynced")}</th>
                <th className="px-4 py-3 text-right">{t("campaignDetail.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    {emptyLabel || t("campaignDetail.noCreatorHint")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const metrics = asMetrics(row.metrics);
                  const link = row.published_link?.trim() || "";
                  const network = postNetwork(row);
                  const name = row.creator?.artistic_name || row.creator?.full_name || "";

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
                      <td className="px-4 py-3.5 font-black text-slate-900">{metricNumber(metrics.views) != null ? formatNumber(metricNumber(metrics.views) ?? 0) : "—"}</td>
                      <td className="px-4 py-3.5 font-black text-slate-900">{metricNumber(metrics.likes) != null ? formatNumber(metricNumber(metrics.likes) ?? 0) : "—"}</td>
                      <td className="px-4 py-3.5 font-black text-slate-900">{metricNumber(metrics.comments) != null ? formatNumber(metricNumber(metrics.comments) ?? 0) : "—"}</td>
                      <td className="px-4 py-3.5 font-black text-slate-900">{formatEngagement(metricNumber(metrics.engagement), locale)}</td>
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
      })),
    [rows],
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
    />
  );
}
