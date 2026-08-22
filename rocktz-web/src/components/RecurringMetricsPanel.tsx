"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PostMetricsPanel, type PostMetricsRow } from "@/components/CampaignMetricsPanel";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import type { PlanningItem, RecurringContract } from "@/lib/types";

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

export function RecurringMetricsPanel({ contract, items, month, onMonthChange, locale, formatNumber, onContract }: Props) {
  const { t } = useTranslation("app");
  const [syncing, setSyncing] = useState<"all" | number | null>(null);

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

  const monthItems = useMemo(() => items.filter((item) => item.month === month), [items, month]);

  const rows = useMemo<PostMetricsRow[]>(
    () =>
      monthItems.map((item) => ({
        id: item.id,
        creator: item.creator,
        published_link: item.published_url,
        metrics: item.metrics,
        subtitle: item.title,
        networkHint: networkHint(item.content_type),
      })),
    [monthItems],
  );

  async function refresh(itemId?: number) {
    if (!rows.some((row) => row.published_link?.trim())) {
      await alertWarning(t("campaignDetail.metricsEmpty"), t("recurringDetail.metricsEmptyHint"));
      return;
    }

    setSyncing(itemId ?? "all");
    try {
      const response = await api.syncRecurringPostMetrics(contract.id, {
        month,
        content_planning_item_id: itemId,
      });
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
      onRefresh={(rowId) => void refresh(rowId)}
      emptyLabel={t("recurringDetail.metricsEmpty")}
      emptyHint={t("recurringDetail.metricsHint")}
      headerExtra={
        <div className="w-full sm:w-56">
          <Select2Field
            theme="light"
            placeholder={t("recurringDetail.refMonth")}
            value={month}
            options={monthOptions}
            onChange={onMonthChange}
          />
        </div>
      }
    />
  );
}
