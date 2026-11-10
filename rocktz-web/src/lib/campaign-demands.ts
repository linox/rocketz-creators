import type { Campaign, CampaignCreator, CampaignDemand } from "@/lib/types";

export function projectDemand(row: CampaignCreator, demand: CampaignDemand): CampaignCreator {
  return {
    ...row,
    delivery_status: demand.delivery_status,
    script_status: demand.script_status,
    video_status: demand.video_status,
    script_feedback: demand.script_feedback ?? null,
    video_feedback: demand.video_feedback ?? null,
    revision_details: demand.revision_details ?? null,
    pending_upload_id: demand.pending_upload_id ?? null,
    upload_progress: demand.upload_progress ?? null,
    script_submitted_at: demand.script_submitted_at ?? null,
    video_submitted_at: demand.video_submitted_at ?? null,
    content: demand.content ?? null,
    demands: undefined,
  };
}

const FORMAT_LABELS: Array<[string, (count: number) => string]> = [
  ["reels", (count) => `${count}x Reel${count > 1 ? "s" : ""}`],
  ["stories", (count) => `${count}x Stories`],
  ["tiktok", (count) => `${count}x TikTok`],
  ["ugc", (count) => `${count}x UGC`],
  ["posts", (count) => `${count}x Post${count > 1 ? "s" : ""}`],
  ["youtube", (count) => `${count}x YouTube`],
  ["live_instagram", (count) => `${count}x Live Instagram`],
  ["live_tiktok", (count) => `${count}x Live TikTok`],
  ["live_youtube", (count) => `${count}x Live YouTube`],
];

export function formatDeliverableCounts(source?: Record<string, string | number | null> | null) {
  if (!source) return "";
  return FORMAT_LABELS.flatMap(([key, label]) => {
    const count = Number(source[key] ?? 0) || 0;
    return count > 0 ? [label(count)] : [];
  }).join(" + ");
}

export function creatorDeliveryLabel(
  row: { deliverables?: Record<string, number> | null; delivery_type?: string | null },
  campaignDeliverables?: Campaign["deliverables"],
) {
  if (row.deliverables) return formatDeliverableCounts(row.deliverables);
  const summary = typeof campaignDeliverables?.summary === "string" ? campaignDeliverables.summary.trim() : "";
  return summary || formatDeliverableCounts(campaignDeliverables) || row.delivery_type || "";
}

export function demandProgress(row: CampaignCreator) {
  const demands = row.demands ?? [];
  if (!demands.length) return null;
  const done = demands.filter((demand) => {
    const delivery = demand.delivery_status;
    return delivery === "sent"
      || delivery === "revision"
      || delivery === "approved"
      || delivery === "published"
      || demand.script_status === "submitted"
      || demand.script_status === "approved"
      || demand.video_status === "submitted"
      || demand.video_status === "approved";
  }).length;
  return { done, total: demands.length };
}
