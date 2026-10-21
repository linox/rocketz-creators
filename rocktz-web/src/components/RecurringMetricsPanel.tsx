"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PostMetricsPanel, type PostMetricsRow, type PostMetricsSyncStatusView } from "@/components/CampaignMetricsPanel";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/laravel";
import { userHidesCreatorValues } from "@/lib/auth";
import { useAuth } from "@/lib/use-auth";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { moneyCurrency } from "@/lib/geo";
import type { PlanningItem, PostMetricsSyncProgress, PostMetricsSyncResult, RecurringContract } from "@/lib/types";

type Props = {
  contract: RecurringContract;
  items: PlanningItem[];
  month: string;
  onMonthChange: (month: string) => void;
  locale: string;
  formatNumber: (value: number) => string;
  onContract: (contract: RecurringContract) => void;
};

function networkHint(contentType: string): string {
  const type = contentType.toLowerCase();
  if (type.includes("tiktok")) return "tiktok";
  if (type.includes("youtube")) return "youtube";
  if (type.includes("instagram") || ["reel", "reels", "story", "stories", "post", "posts"].includes(type)) return "instagram";
  return "";
}

function statusFromJob(
  job: { status?: string; message?: string; progress?: PostMetricsSyncProgress | null; sync?: Record<string, PostMetricsSyncResult> },
  scopeLabel: string,
): PostMetricsSyncStatusView {
  const progressItems = job.progress?.items ?? [];
  const syncItems = Object.entries(job.sync ?? {}).map(([id, row]) => ({
    id: Number(id),
    status: (row.ok ? "done" : "failed") as "done" | "failed",
    message: row.message ?? null,
  }));
  const items = progressItems.length > 0 ? progressItems : syncItems;
  const failed = items.filter((item) => item.status === "failed").length;
  const phase: PostMetricsSyncStatusView["phase"] =
    job.status === "failed"
      ? "failed"
      : job.status === "done"
        ? failed > 0
          ? "partial"
          : "done"
        : job.status === "queued"
          ? "queued"
          : "running";

  return {
    phase,
    scopeLabel,
    total: job.progress?.total ?? items.length,
    processed: job.progress?.processed ?? items.filter((item) => item.status === "done" || item.status === "failed").length,
    message: job.message ?? items.find((item) => item.message)?.message ?? null,
    items,
  };
}

export function RecurringMetricsPanel({ contract, items, month, onMonthChange, locale, formatNumber, onContract }: Props) {
  const { t } = useTranslation("app");
  const hideCreatorValues = userHidesCreatorValues(useAuth());
  const [syncing, setSyncing] = useState<"all" | number | null>(null);
  const [syncStatus, setSyncStatus] = useState<PostMetricsSyncStatusView | null>(null);

  const monthOptions = useMemo(() => {
    const months = [...new Set(items.map((item) => item.month).filter(Boolean))].sort().reverse();
    if (month && !months.includes(month)) {
      months.unshift(month);
    }
    return months.map((value) => ({
      value,
      label: new Date(`${value}-02`).toLocaleDateString(locale, { month: "long", year: "numeric" }),
    }));
  }, [items, month, locale]);

  const monthLabel = monthOptions.find((option) => option.value === month)?.label ?? month;
  const monthItems = useMemo(() => items.filter((item) => item.month === month), [items, month]);

  useEffect(() => {
    setSyncStatus(null);
  }, [month]);
  const costByCreator = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of contract.creators ?? []) {
      map.set(row.creator_id, hideCreatorValues ? 0 : Number(row.monthly_cache ?? row.monthly_fee ?? 0));
    }
    return map;
  }, [contract.creators, hideCreatorValues]);

  const rows = useMemo<PostMetricsRow[]>(
    () =>
      monthItems.map((item) => ({
        id: item.id,
        creator: item.creator,
        published_link: item.published_url,
        metrics: item.metrics,
        subtitle: item.title,
        networkHint: networkHint(item.content_type),
        videoDownloadUrl:
          item.video_status === "approved" || item.status === "approved"
            ? item.video_download_url || item.media_url || item.submission_url || null
            : null,
        cost: costByCreator.get(item.creator_id) ?? 0,
        costKey: item.creator_id,
      })),
    [costByCreator, monthItems],
  );

  async function refresh(itemId?: number) {
    if (!rows.some((row) => row.published_link?.trim())) {
      await alertWarning(t("campaignDetail.metricsEmpty"), t("recurringDetail.metricsEmptyHint"));
      return;
    }

    const targets = rows.filter((row) => row.published_link?.trim() && (itemId == null || row.id === itemId));
    setSyncStatus({
      phase: "queued",
      scopeLabel: monthLabel,
      total: targets.length,
      processed: 0,
      items: targets.map((row) => ({ id: row.id, status: "pending" })),
    });
    setSyncing(itemId ?? "all");
    try {
      const response = await api.syncRecurringPostMetrics(
        contract.id,
        {
          month,
          content_planning_item_id: itemId,
        },
        (job) =>
          setSyncStatus((current) => {
            const next = statusFromJob(job, monthLabel);
            if (next.items.length === 0 && current?.items.length) {
              return { ...current, phase: next.phase, message: next.message ?? current.message };
            }
            return next;
          }),
      );
      setSyncStatus(statusFromJob(response, monthLabel));
      if (!response.data) {
        return;
      }
      onContract(response.data);
      const failed = Object.values(response.sync ?? {}).filter((row) => !row.ok);
      if (failed.length > 0) {
        await alertWarning(
          t("campaignDetail.metricsPartialTitle"),
          failed[0]?.message || t("campaignDetail.metricsPartialHint", { count: failed.length }),
        );
      } else {
        await alertSuccess(t("campaignDetail.metricsUpdated"));
      }
    } catch (err) {
      const payload = err instanceof ApiError ? (err.payload as { progress?: PostMetricsSyncProgress | null; message?: string } | undefined) : undefined;
      setSyncStatus((current) => {
        const next = statusFromJob(
          {
            status: "failed",
            message: err instanceof ApiError ? err.message : undefined,
            progress: payload?.progress,
          },
          monthLabel,
        );
        if (next.items.length === 0 && current?.items.length) {
          return { ...current, phase: "failed", message: next.message ?? current.message };
        }
        return next;
      });
      await alertApiError(err);
    } finally {
      setSyncing(null);
    }
  }

  return (
    <PostMetricsPanel
      rows={rows}
      locale={locale}
      formatNumber={formatNumber}
      syncing={syncing}
      syncStatus={syncStatus}
      onRefresh={(rowId) => void refresh(rowId)}
      emptyLabel={t("recurringDetail.metricsEmpty")}
      emptyHint={t("recurringDetail.metricsHint")}
      currency={moneyCurrency(contract)}
      headerExtra={
        <div className="w-full sm:w-56">
          <Select2Field
            theme="light"
            placeholder={t("recurringDetail.refMonth")}
            value={month}
            options={monthOptions}
            disabled={syncing !== null}
            onChange={onMonthChange}
          />
        </div>
      }
    />
  );
}
