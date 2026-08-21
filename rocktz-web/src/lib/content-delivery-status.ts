import type { CampaignCreator, PlanningItem } from "@/lib/types";

export type ContentDeliveryState =
  | "published"
  | "approved"
  | "scriptRevision"
  | "videoRevision"
  | "revision"
  | "scriptReview"
  | "videoReview"
  | "scriptApproved"
  | "sent"
  | "waiting";

export const CONTENT_DELIVERY_STATES: ContentDeliveryState[] = [
  "waiting",
  "scriptReview",
  "scriptApproved",
  "scriptRevision",
  "videoReview",
  "videoRevision",
  "revision",
  "sent",
  "approved",
  "published",
];

function isStagedFlow(flow?: string | null) {
  return flow !== "video_only";
}

export function campaignCreatorDeliveryState(row: CampaignCreator, flow?: string | null): ContentDeliveryState {
  const delivery = row.delivery_status;
  if (delivery === "published") return "published";
  if (delivery === "approved") return "approved";

  const staged = isStagedFlow(flow);
  const scriptOnly = flow === "script_only";
  const scriptApproved = row.script_status === "approved";
  const videoApproved = row.video_status === "approved";
  const hasScript = Boolean(row.content?.script?.trim());
  const hasVideo = Boolean(row.content?.video_url?.trim());

  if (videoApproved && (!staged || scriptApproved || scriptOnly)) return "approved";
  if (scriptOnly && scriptApproved) return "approved";

  if (row.script_status === "revision") return "scriptRevision";
  if (row.video_status === "revision") return "videoRevision";
  if (delivery === "revision") return "revision";

  if (staged && !scriptApproved && (row.script_status === "submitted" || (hasScript && !hasVideo))) {
    return "scriptReview";
  }
  if (row.video_status === "submitted" || (hasVideo && !videoApproved && (!staged || scriptApproved))) {
    return "videoReview";
  }
  if (staged && scriptApproved && !videoApproved) return "scriptApproved";
  if (delivery === "sent") return "sent";
  return "waiting";
}

export function planningItemDeliveryState(item: PlanningItem | null): ContentDeliveryState {
  if (!item) return "waiting";
  if (item.status === "published") return "published";
  if (item.status === "approved") return "approved";

  const flow = item.approval_flow || "script_and_video";
  const staged = isStagedFlow(flow);
  const scriptOnly = flow === "script_only";
  const scriptApproved = item.script_status === "approved";
  const videoApproved = item.video_status === "approved";
  const hasScript = Boolean(item.script?.trim());
  const hasVideo = Boolean(item.media_url?.trim() || item.submission_url?.trim());

  if (videoApproved && (!staged || scriptApproved || scriptOnly)) return "approved";
  if (scriptOnly && scriptApproved) return "approved";

  if (item.script_status === "revision") return "scriptRevision";
  if (item.video_status === "revision") return "videoRevision";
  if (item.status === "rejected") return "revision";

  if (staged && !scriptApproved && (item.script_status === "submitted" || (hasScript && !hasVideo))) {
    return "scriptReview";
  }
  if (item.video_status === "submitted" || (hasVideo && !videoApproved && (!staged || scriptApproved))) {
    return "videoReview";
  }
  if (staged && scriptApproved && !videoApproved) return "scriptApproved";
  if (item.status === "review") return "sent";
  return "waiting";
}

export function isRevisionDelivery(state: ContentDeliveryState) {
  return state === "revision" || state === "scriptRevision" || state === "videoRevision";
}

export function isApprovedDelivery(state: ContentDeliveryState) {
  return state === "approved" || state === "published";
}

export function deliveryStatusRank(state: ContentDeliveryState) {
  if (isRevisionDelivery(state)) return 0;
  if (state === "waiting") return 1;
  if (state === "scriptApproved") return 2;
  if (state === "scriptReview" || state === "videoReview" || state === "sent") return 3;
  if (state === "approved") return 4;
  return 5;
}
