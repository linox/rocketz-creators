import type { CampaignCreator, CampaignDemand } from "@/lib/types";

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
    content: demand.content ?? null,
    demands: undefined,
  };
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
