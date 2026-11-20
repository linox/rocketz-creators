import { currentYearMonth } from "@/lib/calendar";
import type { Campaign, PlanningItem } from "@/lib/types";

export type OpenBacklogEntry = {
  id: string;
  title: string;
  month: string;
  meta?: string | null;
  href?: string;
  onOpen?: () => void;
  /** Campaign left behind after its month. Rendered louder than other open work. */
  late?: boolean;
};

type ScheduleCampaign = {
  status?: string | null;
  delivery_date?: string | null;
  end_date?: string | null;
  start_date?: string | null;
};

type ScheduleParticipation = {
  delivery_date?: string | null;
  post_date?: string | null;
  delivery_status?: string | null;
  application_status?: string | null;
  demands?: { delivery_status?: string | null }[] | null;
};

function yearMonth(value?: string | null) {
  return value?.match(/^(\d{4}-\d{2})/)?.[1] ?? null;
}

export function planningPeriod(item: { month?: string | null; planned_date?: string | null; post_date?: string | null }) {
  return yearMonth(item.month) ?? yearMonth(item.planned_date) ?? yearMonth(item.post_date);
}

export function planningStillOpen(item: { status?: string | null; published_url?: string | null }) {
  if (item.status === "published" || item.status === "rejected") return false;
  return !item.published_url?.trim();
}

export function campaignParticipationStillOpen(campaign: ScheduleCampaign, row: ScheduleParticipation) {
  if (campaign.status === "finished") return false;
  if (row.application_status && row.application_status !== "approved") return false;
  if (row.demands?.length) return row.demands.some((demand) => demand.delivery_status !== "published");
  return row.delivery_status !== "published";
}

function scheduleMonths(campaign: ScheduleCampaign, row: ScheduleParticipation) {
  return [row.delivery_date || campaign.delivery_date, row.post_date, campaign.end_date, campaign.start_date]
    .map((value) => yearMonth(value))
    .filter((value): value is string => Boolean(value));
}

/** Month the piece was due, when it is still open and that month has already passed. */
export function campaignLeftBehindMonth(campaign: ScheduleCampaign, row: ScheduleParticipation, current = currentYearMonth()) {
  if (!campaignParticipationStillOpen(campaign, row)) return null;
  const delivery = yearMonth(row.delivery_date || campaign.delivery_date || row.post_date);
  if (delivery && delivery < current) return delivery;
  const months = scheduleMonths(campaign, row);
  if (months.length > 0 && months.every((month) => month < current)) return [...months].sort()[0];
  return null;
}

/** Bucket used by the creator agenda. Open work from past months stays on the current month. */
export function campaignVisibleMonth(campaign: ScheduleCampaign, row: ScheduleParticipation, current = currentYearMonth()) {
  const months = scheduleMonths(campaign, row);
  if (months.length === 0) return campaign.status === "finished" ? null : current;
  if (campaignLeftBehindMonth(campaign, row, current)) return current;
  const ahead = months.filter((month) => month >= current).sort();
  if (ahead[0]) return ahead[0];
  return campaign.status === "finished" ? null : current;
}

export function planningLeftBehindMonth(
  item: { status?: string | null; published_url?: string | null; month?: string | null; planned_date?: string | null; post_date?: string | null },
  current = currentYearMonth(),
) {
  if (!planningStillOpen(item)) return null;
  const month = planningPeriod(item);
  return month && month < current ? month : null;
}

export function planningVisibleMonth(
  item: { status?: string | null; published_url?: string | null; month?: string | null; planned_date?: string | null; post_date?: string | null },
  current = currentYearMonth(),
) {
  const month = planningPeriod(item);
  if (!month) return current;
  if (month < current) return planningStillOpen(item) ? current : null;
  return month;
}

export function campaignBacklog(campaigns: Campaign[], current = currentYearMonth()): OpenBacklogEntry[] {
  const entries: OpenBacklogEntry[] = [];
  for (const campaign of campaigns) {
    for (const row of campaign.applications ?? []) {
      const month = campaignLeftBehindMonth(campaign, row, current);
      if (!month) continue;
      entries.push({
        id: `campaign-${row.id}`,
        href: `/campaigns/${campaign.id}`,
        title: campaign.name,
        meta: row.creator?.artistic_name || row.creator?.full_name || null,
        month,
      });
    }
  }
  return entries.sort((a, b) => a.month.localeCompare(b.month) || a.title.localeCompare(b.title));
}

export function planningBacklog(items: PlanningItem[], current = currentYearMonth()): OpenBacklogEntry[] {
  const entries: OpenBacklogEntry[] = [];
  for (const item of items) {
    const month = planningLeftBehindMonth(item, current);
    if (!month) continue;
    entries.push({
      id: `planning-${item.id}`,
      href: `/recurring/${item.recurring_contract_id}?month=${month}`,
      title: item.title || item.creator?.artistic_name || item.creator?.full_name || "—",
      meta: [item.creator?.artistic_name || item.creator?.full_name, item.company?.name].filter(Boolean).join(" · ") || null,
      month,
    });
  }
  return entries.sort((a, b) => a.month.localeCompare(b.month) || a.title.localeCompare(b.title));
}
