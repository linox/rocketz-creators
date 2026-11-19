import type { Campaign, CampaignCreator, CampaignDemand } from "@/lib/types";

type DeliveryContent = NonNullable<CampaignCreator["content"]>;

export function versionVideoUrl(content?: CampaignCreator["content"] | null): string {
  const versions = content?.submission_versions ?? [];
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    const entry = versions[index];
    if (entry.stage !== "video") continue;
    const url = (entry.video_url || entry.media_url || entry.submission_url || "").trim();
    if (url) return url;
  }
  return "";
}

export function resolvedVideoUrl(content?: CampaignCreator["content"] | null): string {
  return content?.video_url?.trim() || versionVideoUrl(content);
}

function contentHasScript(content?: CampaignCreator["content"] | null, submittedAt?: string | null): boolean {
  if (submittedAt) return true;
  if (content?.script?.trim() || content?.script_file_url?.trim()) return true;
  return (content?.submission_versions ?? []).some((entry) => entry.stage === "script" && Boolean(entry.script?.trim() || entry.script_file_url?.trim()));
}

function contentHasVideo(content?: CampaignCreator["content"] | null, submittedAt?: string | null): boolean {
  return Boolean(submittedAt || resolvedVideoUrl(content) || content?.image_url?.trim() || content?.published_link?.trim());
}

function blankContent(source?: CampaignCreator["content"] | null): DeliveryContent {
  return {
    script: source?.script ?? null,
    script_file_url: source?.script_file_url ?? null,
    script_file_name: source?.script_file_name ?? null,
    video_url: source?.video_url ?? null,
    video_file_size: source?.video_file_size,
    video_download_url: source?.video_download_url ?? null,
    image_url: source?.image_url ?? null,
    published_link: source?.published_link ?? null,
    script_version: source?.script_version,
    video_version: source?.video_version,
    submission_versions: source?.submission_versions,
    revision_history: source?.revision_history,
    movements: source?.movements,
    story_prints: source?.story_prints,
    metrics: source?.metrics,
  };
}

/** Demand content, with a legacy participation file shown on the slot that does not have one yet. */
export function demandDisplayContent(row: CampaignCreator, demand: CampaignDemand): DeliveryContent {
  const content = blankContent(demand.content);
  const fromVersions = versionVideoUrl(content);
  if (!content.video_url?.trim() && fromVersions) content.video_url = fromVersions;

  const parent = row.content;
  const demands = row.demands ?? [];
  if (!parent || !demands.length) return content;

  const scriptTaken = demands.some((item) => contentHasScript(item.content, item.script_submitted_at));
  if (!scriptTaken && contentHasScript(parent, row.script_submitted_at) && !contentHasScript(content)) {
    const host = demands.find((item) => !contentHasScript(item.content, item.script_submitted_at));
    if (host?.id === demand.id) {
      content.script = parent.script ?? null;
      content.script_file_url = parent.script_file_url ?? null;
      content.script_file_name = parent.script_file_name ?? null;
      content.script_version = parent.script_version;
      if (!content.submission_versions?.length) content.submission_versions = parent.submission_versions;
    }
  }

  const videoTaken = demands.some((item) => contentHasVideo(item.content, item.video_submitted_at));
  if (!videoTaken && contentHasVideo(parent, row.video_submitted_at) && !contentHasVideo(content)) {
    const host = demands.find((item) => !contentHasVideo(item.content, item.video_submitted_at));
    if (host?.id === demand.id) {
      content.video_url = resolvedVideoUrl(parent) || null;
      content.video_file_size = parent.video_file_size;
      content.video_download_url = parent.video_download_url ?? null;
      content.image_url = parent.image_url ?? null;
      content.published_link = parent.published_link ?? null;
      content.video_version = parent.video_version;
      const parentVideos = (parent.submission_versions ?? []).filter((entry) => entry.stage === "video");
      if (parentVideos.length && !(content.submission_versions ?? []).some((entry) => entry.stage === "video")) {
        content.submission_versions = [...(content.submission_versions ?? []), ...parentVideos];
      }
    }
  }

  return content;
}

export function participationHasVideo(row: Pick<CampaignCreator, "content" | "video_submitted_at" | "video_status" | "demands">): boolean {
  if (row.video_submitted_at || resolvedVideoUrl(row.content)) return true;
  if (row.video_status === "submitted" || row.video_status === "revision" || row.video_status === "approved") return true;
  return (row.demands ?? []).some((demand) => (
    Boolean(demand.video_submitted_at)
    || demand.video_status === "submitted"
    || demand.video_status === "revision"
    || demand.video_status === "approved"
    || Boolean(resolvedVideoUrl(demand.content))
    || Boolean(demand.content?.published_link?.trim())
  ));
}

export function projectDemand(row: CampaignCreator, demand: CampaignDemand): CampaignCreator {
  return {
    ...row,
    delivery_status: demand.delivery_status,
    script_status: demand.script_status,
    video_status: demand.video_status,
    script_feedback: demand.script_feedback ?? null,
    video_feedback: demand.video_feedback ?? null,
    script_liked: Boolean(demand.script_liked),
    script_reaction: demand.script_reaction ?? null,
    video_liked: Boolean(demand.video_liked),
    video_reaction: demand.video_reaction ?? null,
    revision_details: demand.revision_details ?? null,
    pending_upload_id: demand.pending_upload_id ?? null,
    upload_progress: demand.upload_progress ?? null,
    script_submitted_at: demand.script_submitted_at ?? null,
    video_submitted_at: demand.video_submitted_at ?? null,
    content: demand.content ?? null,
    demands: undefined,
  };
}

export function presentDemand(row: CampaignCreator, demand: CampaignDemand): CampaignCreator {
  const content = demandDisplayContent(row, demand);
  const hasOwnVideo = Boolean(resolvedVideoUrl(demand.content) || demand.video_submitted_at);
  const inheritedVideo = Boolean(resolvedVideoUrl(content) && !hasOwnVideo);
  const inheritedScript = Boolean(
    (content.script?.trim() || content.script_file_url?.trim())
    && !demand.content?.script?.trim()
    && !demand.content?.script_file_url?.trim()
    && !demand.script_submitted_at
  );
  const projected = projectDemand(row, { ...demand, content });
  const parentScript = row.script_status && row.script_status !== "pending" ? row.script_status : null;
  const parentVideo = row.video_status && row.video_status !== "pending" ? row.video_status : null;

  return {
    ...projected,
    delivery_type: demand.content_type,
    script_status: inheritedScript && (!demand.script_status || demand.script_status === "pending")
      ? (parentScript || "submitted")
      : projected.script_status,
    script_submitted_at: projected.script_submitted_at || (inheritedScript ? row.script_submitted_at ?? null : null),
    video_status: (inheritedVideo || hasOwnVideo) && (!demand.video_status || demand.video_status === "pending")
      ? (parentVideo || "submitted")
      : projected.video_status,
    video_submitted_at: projected.video_submitted_at || (inheritedVideo ? row.video_submitted_at ?? null : null),
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
