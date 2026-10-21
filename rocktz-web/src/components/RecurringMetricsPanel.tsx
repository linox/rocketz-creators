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
import type { PlanningItem, PostMetricsSyncItemStatus, PostMetricsSyncResult, RecurringContract } from "@/lib/types";

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

function syncEntry(sync: Record<string, PostMetricsSyncResult> | undefined, id: number): PostMetricsSyncResult | undefined {
  if (!sync) return undefined;
  return sync[id] ?? sync[String(id)];
}

function patchSyncItem(
  status: PostMetricsSyncStatusView,
  id: number,
  itemStatus: PostMetricsSyncItemStatus,
  message?: string | null,
): PostMetricsSyncStatusView {
  const items = status.items.map((item) => (item.id === id ? { ...item, status: itemStatus, message: message ?? null } : item));
  return {
    ...status,
    items,
    processed: items.filter((item) => item.status === "done" || item.status === "failed").length,
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
    let status: PostMetricsSyncStatusView = {
      phase: "running",
      scopeLabel: monthLabel,
      total: targets.length,
      processed: 0,
      items: targets.map((row) => ({ id: row.id, status: "pending" })),
    };
    setSyncStatus(status);
    setSyncing(itemId ?? "all");
    const failures: string[] = [];
    let aborted: unknown = null;

    try {
      for (const target of targets) {
        status = patchSyncItem(status, target.id, "running");
        setSyncStatus(status);

        try {
          const response = await api.syncRecurringPostMetrics(contract.id, {
            month,
            content_planning_item_id: target.id,
          });
          if (response.data) onContract(response.data);
          const entry = syncEntry(response.sync, target.id);
          if (entry && !entry.ok) {
            const message = entry.message || t("campaignDetail.metricsPartialHint", { count: 1 });
            failures.push(message);
            status = patchSyncItem(status, target.id, "failed", message);
          } else {
            status = patchSyncItem(status, target.id, "done");
          }
        } catch (err) {
          const message = err instanceof ApiError ? err.message : t("campaignDetail.metricsSyncFailed");
          failures.push(message);
          status = patchSyncItem(status, target.id, "failed", message);
          const stop = !(err instanceof ApiError) || (err.status !== 422 && err.status !== 408);
          if (stop) {
            aborted = err;
            break;
          }
        }

        setSyncStatus(status);
      }
    } finally {
      setSyncing(null);
    }

    const failedCount = status.items.filter((item) => item.status === "failed").length;
    const doneCount = status.items.filter((item) => item.status === "done").length;
    status = {
      ...status,
      phase: doneCount === 0 ? "failed" : failedCount > 0 ? "partial" : "done",
      message: failures.find(Boolean) ?? null,
    };
    setSyncStatus(status);

    if (aborted) {
      await alertApiError(aborted);
    } else if (failedCount > 0) {
      await alertWarning(
        t("campaignDetail.metricsPartialTitle"),
        failures.find(Boolean) || t("campaignDetail.metricsPartialHint", { count: failedCount }),
      );
    } else {
      await alertSuccess(t("campaignDetail.metricsUpdated"));
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
