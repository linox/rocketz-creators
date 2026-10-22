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
import type { PlanningItem, PostMetricsSyncProgress, RecurringContract } from "@/lib/types";

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

function statusFromProgress(
  phase: PostMetricsSyncStatusView["phase"],
  scopeLabel: string,
  progress: PostMetricsSyncProgress | null | undefined,
  message?: string | null,
): PostMetricsSyncStatusView | null {
  if (!progress) return null;
  return {
    phase,
    scopeLabel,
    total: progress.total,
    processed: progress.processed,
    message: message ?? null,
    items: progress.items,
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
    const targets = rows.filter((row) => row.published_link?.trim() && (itemId == null || row.id === itemId));
    if (!targets.length) {
      await alertWarning(t("campaignDetail.metricsEmpty"), t("recurringDetail.metricsEmptyHint"));
      return;
    }

    const initial: PostMetricsSyncStatusView = {
      phase: "queued",
      scopeLabel: monthLabel,
      total: targets.length,
      processed: 0,
      items: targets.map((row) => ({ id: row.id, status: "pending" })),
    };
    setSyncStatus(initial);
    setSyncing(itemId ?? "all");

    try {
      const response = await api.syncRecurringPostMetrics(
        contract.id,
        itemId == null ? { month } : { month, content_planning_item_id: itemId },
        (state) => {
          const phase = state.status === "queued" ? "queued" : "running";
          const next = statusFromProgress(phase, monthLabel, state.progress, state.message);
          setSyncStatus(next ?? { ...initial, phase });
        },
      );
      if (response.data) onContract(response.data);
      const failures = Object.values(response.sync ?? {}).filter((item) => item && !item.ok);
      const message = failures.find((item) => item.message)?.message ?? null;
      setSyncStatus(
        statusFromProgress(failures.length > 0 ? "partial" : "done", monthLabel, response.progress, message) ?? {
          ...initial,
          phase: failures.length > 0 ? "partial" : "done",
          processed: targets.length,
          message,
          items: targets.map((row) => ({
            id: row.id,
            status: failures.length > 0 ? "failed" : "done",
            message,
          })),
        },
      );
      if (failures.length > 0) {
        await alertWarning(
          t("campaignDetail.metricsPartialTitle"),
          message || t("campaignDetail.metricsPartialHint", { count: failures.length }),
        );
      } else {
        await alertSuccess(t("campaignDetail.metricsUpdated"));
      }
    } catch (err) {
      const payload = err instanceof ApiError && err.payload && typeof err.payload === "object"
        ? err.payload as { progress?: PostMetricsSyncProgress; message?: string }
        : undefined;
      const message = err instanceof ApiError ? err.message : t("campaignDetail.metricsSyncFailed");
      setSyncStatus(statusFromProgress("failed", monthLabel, payload?.progress, message) ?? { ...initial, phase: "failed", message });
      if (err instanceof ApiError && err.status === 422) {
        await alertWarning(t("campaignDetail.metricsSyncFailed"), message);
      } else {
        await alertApiError(err);
      }
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
