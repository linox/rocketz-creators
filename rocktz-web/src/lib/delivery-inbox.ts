import { projectDemand } from "@/lib/campaign-demands";
import { calendarDateKey, effectivePlanningDueDate, isDateBeforeToday, isoToday } from "@/lib/delivery-date";
import { namedPautaTitle } from "@/lib/pauta-briefing";
import type { Campaign, CampaignCreator, CampaignDemand, PlanningItem, RecurringContract } from "@/lib/types";

export type DeliverySourceType = "campaign" | "recurring";
export type DeliveryContentType =
  | "video"
  | "image"
  | "carousel"
  | "story"
  | "script"
  | "caption"
  | "file"
  | "link"
  | "other";

export type DeliveryStatus =
  | "unread"
  | "pending_approval"
  | "revision_requested"
  | "new_version"
  | "approved"
  | "overdue"
  | "archived";

export type DeliveryApprovalStage = "script" | "video" | "delivery" | "recurring";

export type DeliveryVersion = {
  id: string;
  versionNumber: number;
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
  fileName?: string | null;
  durationLabel?: string | null;
  createdAt: string;
  creatorMessage?: string | null;
  status: DeliveryStatus;
  scriptText?: string | null;
  captionText?: string | null;
  linkUrl?: string | null;
  imageUrls?: string[];
};

export type DeliveryActivity = {
  id: string;
  type: "submitted" | "revision" | "approved" | "comment" | "viewed";
  userName: string;
  message?: string | null;
  createdAt: string;
};

export type DeliveryRevision = {
  id: string;
  stage: string;
  note: string;
  requestedAt: string;
};

export type DeliveryMovementType =
  | "script_submitted"
  | "script_approved"
  | "script_revision"
  | "video_submitted"
  | "video_approved"
  | "video_revision"
  | "published";

export type DeliveryMovement = {
  id: string;
  type: DeliveryMovementType;
  at?: string | null;
  note?: string | null;
  version?: number | null;
};

export type DeliveryInboxItem = {
  id: string;
  title: string;
  formatLabel: string;
  creatorId: string;
  creatorName: string;
  creatorPhoto?: string | null;
  companyId: string;
  companyName: string;
  sourceType: DeliverySourceType;
  sourceId: string;
  sourceName: string;
  contentType: DeliveryContentType;
  status: DeliveryStatus;
  createdAt: string;
  viewedAt: string | null;
  approvalDeadline?: string | null;
  publicationDate?: string | null;
  responsibleUserName: string;
  currentVersion: number;
  versions: DeliveryVersion[];
  activity: DeliveryActivity[];
  revisions: DeliveryRevision[];
  movements: DeliveryMovement[];
  archived?: boolean;
  participationId?: number | null;
  /** Campaign demand approved from this inbox row. */
  demandId?: number | null;
  demandPosition?: number | null;
  demandTotal?: number | null;
  planningItemId?: number | null;
  approvalStage?: DeliveryApprovalStage;
  /** 1 = script, 2 = video when staged approval flow */
  stagePart?: 1 | 2 | null;
  stageTotal?: 1 | 2 | null;
  /** YYYY-MM for recurring pautas (distinguishes 2/2 of Aug vs Sep). */
  period?: string | null;
  /** Recurring content_type / campaign delivery type, e.g. reel */
  formatKey?: string | null;
  /** Campaign demand brief. Shown in the body, never as the row title. */
  brief?: string | null;
};

export type InboxFolder =
  | "all"
  | "unread"
  | "pending_approval"
  | "revision_requested"
  | "new_version"
  | "approved"
  | "on_track"
  | "overdue"
  | "archived";

export type InboxQuickFilter = "all" | "pending" | "on_track" | "today" | "week";
export type InboxSourceFilter = "all" | "campaign" | "recurring";
export type InboxViewMode = "inbox" | "table";

const VIEWED_KEY = "rocketz:delivery-viewed";
const ARCHIVED_KEY = "rocketz:delivery-archived";

function readStringMap(key: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStringMap(key: string, map: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(map));
}

export function persistDeliveryViewed(id: string, at = new Date().toISOString()) {
  const map = readStringMap(VIEWED_KEY);
  map[id] = at;
  writeStringMap(VIEWED_KEY, map);
}

export function persistDeliveryArchived(id: string, archived: boolean) {
  const map = readStringMap(ARCHIVED_KEY);
  if (archived) map[id] = "1";
  else delete map[id];
  writeStringMap(ARCHIVED_KEY, map);
}

function applyLocalMeta(items: DeliveryInboxItem[]): DeliveryInboxItem[] {
  const viewed = readStringMap(VIEWED_KEY);
  const archived = readStringMap(ARCHIVED_KEY);
  return items.map((item) => {
    let viewedAt: string | null = viewed[item.id] ?? item.viewedAt;
    const submittedMs = +new Date(item.createdAt);
    const viewedMs = viewedAt ? +new Date(viewedAt) : NaN;
    // Only clear view when there is a real newer submission (2s grace; ignore invalid dates)
    if (
      viewedAt
      && Number.isFinite(submittedMs)
      && Number.isFinite(viewedMs)
      && submittedMs > viewedMs + 2000
    ) {
      viewedAt = null;
    }
    const isArchived = Boolean(archived[item.id]) || item.archived;
    let status = item.status;
    if (isArchived) {
      status = "archived";
    } else if (!viewedAt && (status === "pending_approval" || status === "new_version" || status === "unread")) {
      status = "unread";
    } else if (viewedAt && status === "unread" && inboxHasMaterial(item)) {
      status = "pending_approval";
    }
    return { ...item, viewedAt, archived: isArchived, status };
  });
}

/** Prefer real submission timestamps only — never Date.now() or demand dates (breaks viewed state). */
function submissionAt(...candidates: Array<string | null | undefined>): string {
  for (const value of candidates) {
    if (!value) continue;
    const normalized = value.includes("T") ? value : `${value}T12:00:00`;
    if (!Number.isNaN(+new Date(normalized))) return normalized;
  }
  return "1970-01-01T00:00:00.000Z";
}

/** Epoch fallback used when nothing was actually submitted. Local TZ renders it as 31/12/1969. */
export function isPlaceholderSubmissionTime(iso?: string | null) {
  if (!iso) return true;
  const time = +new Date(iso);
  return !Number.isFinite(time) || time < Date.UTC(1971, 0, 1);
}

function submittedAfterDeadline(submittedAt?: string | null, deadline?: string | null) {
  const submitted = calendarDateKey(submittedAt);
  const due = calendarDateKey(deadline);
  return Boolean(submitted && due && submitted > due);
}

function creatorLabel(row: { artistic_name?: string | null; full_name?: string | null } | null | undefined) {
  return row?.artistic_name || row?.full_name || "—";
}

function namedPlanningTitle(title?: string | null) {
  return namedPautaTitle(title);
}

function mapContentType(raw?: string | null): DeliveryContentType {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return "other";
  if (value.includes("roteiro") || value.includes("script")) return "script";
  if (value.includes("legenda") || value.includes("caption")) return "caption";
  if (value.includes("carrossel") || value.includes("carousel")) return "carousel";
  if (value.includes("story") || value.includes("stories")) return "story";
  if (value.includes("image") || value.includes("imagem") || value.includes("post") || value.includes("banner")) return "image";
  if (value.includes("link") || value.includes("live")) return "link";
  if (value.includes("file") || value.includes("arquivo") || value.includes("pack")) return "file";
  if (
    value.includes("reel")
    || value.includes("video")
    || value.includes("vídeo")
    || value.includes("tiktok")
    || value.includes("youtube")
    || value.includes("ugc")
    || value.includes("unboxing")
  ) {
    return "video";
  }
  return "other";
}

function fileNameFromUrl(url?: string | null) {
  if (!url) return null;
  try {
    const path = new URL(url, "https://local.invalid").pathname;
    const name = path.split("/").filter(Boolean).pop();
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

function revisionNotes(
  history: { stage: string; note: string; requested_at?: string }[] | undefined,
  stage: string,
  fallback: string | null | undefined,
  fallbackAt: string,
  id: string,
): DeliveryRevision[] {
  const stored = (history ?? []).filter((entry) => entry.stage === stage && entry.note?.trim());
  if (stored.length) {
    return stored.map((entry, index) => ({
      id: `${id}-rev-${entry.requested_at || index}`,
      stage,
      note: entry.note.trim(),
      requestedAt: entry.requested_at || fallbackAt,
    }));
  }
  const note = fallback?.trim();
  if (!note) return [];
  return [{ id: `${id}-rev-fallback`, stage, note, requestedAt: fallbackAt }];
}

const MOVEMENT_ORDER: Record<DeliveryMovementType, number> = {
  script_submitted: 1,
  script_revision: 2,
  script_approved: 3,
  video_submitted: 4,
  video_revision: 5,
  video_approved: 6,
  published: 7,
};

function movementTime(iso?: string | null) {
  if (!iso || isPlaceholderSubmissionTime(iso)) return null;
  const time = +new Date(iso);
  return Number.isFinite(time) ? time : null;
}

export function buildDeliveryMovements(source: {
  scriptStatus?: string | null;
  videoStatus?: string | null;
  deliveryStatus?: string | null;
  scriptSubmittedAt?: string | null;
  videoSubmittedAt?: string | null;
  reviewedAt?: string | null;
  versions?: { stage: string; version?: number; submitted_at?: string }[];
  revisions?: { stage: string; note?: string; requested_at?: string }[];
  scriptFeedback?: string | null;
  videoFeedback?: string | null;
  movements?: { type?: string; at?: string | null; note?: string | null }[];
}): DeliveryMovement[] {
  const events: Array<DeliveryMovement & { sortAt: number }> = [];
  const stored = source.movements ?? [];

  const pushSubmission = (
    type: "script_submitted" | "video_submitted",
    stage: "script" | "video",
    submittedAt?: string | null,
  ) => {
    const versions = (source.versions ?? []).filter((entry) => entry.stage === stage);
    if (versions.length) {
      versions.forEach((entry, index) => {
        events.push({
          id: `${type}-${entry.version ?? index}-${entry.submitted_at ?? "n"}`,
          type,
          at: entry.submitted_at ?? null,
          version: entry.version ?? null,
          sortAt: 0,
        });
      });
      return;
    }
    if (submittedAt) {
      events.push({ id: `${type}-at`, type, at: submittedAt, version: 1, sortAt: 0 });
    }
  };

  const pushRevisions = (
    type: "script_revision" | "video_revision",
    stage: "script" | "video",
    fallback?: string | null,
  ) => {
    const history = (source.revisions ?? []).filter((entry) => entry.stage === stage && entry.note?.trim());
    if (history.length) {
      history.forEach((entry, index) => {
        events.push({
          id: `${type}-${entry.requested_at ?? index}`,
          type,
          at: entry.requested_at ?? null,
          note: entry.note?.trim() ?? null,
          sortAt: 0,
        });
      });
      return;
    }
    const note = fallback?.trim();
    if (!note) return;
    if (events.some((entry) => entry.note === note)) return;
    events.push({ id: `${type}-fallback`, type, at: null, note, sortAt: 0 });
  };

  const pushLogged = (type: DeliveryMovementType, active: boolean, fallbackAt?: string | null) => {
    const rows = stored.filter((entry) => entry.type === type);
    if (rows.length) {
      rows.forEach((entry, index) => {
        events.push({
          id: `${type}-${entry.at ?? index}`,
          type,
          at: entry.at ?? null,
          note: entry.note?.trim() || null,
          sortAt: 0,
        });
      });
      return;
    }
    if (!active) return;
    events.push({ id: `${type}-current`, type, at: fallbackAt ?? null, sortAt: 0 });
  };

  pushSubmission("script_submitted", "script", source.scriptSubmittedAt);
  pushSubmission("video_submitted", "video", source.videoSubmittedAt);
  pushRevisions("script_revision", "script", source.scriptFeedback);
  pushRevisions("video_revision", "video", source.videoFeedback);

  const published = source.deliveryStatus === "published";
  const videoApproved = source.videoStatus === "approved";
  const scriptApproved = source.scriptStatus === "approved";
  pushLogged("script_approved", scriptApproved, !videoApproved && !published ? source.reviewedAt : null);
  pushLogged("video_approved", videoApproved, !published ? source.reviewedAt : null);
  pushLogged("published", published, source.reviewedAt);

  for (const event of events) {
    event.sortAt = movementTime(event.at) ?? 0;
  }
  for (const event of events) {
    if (movementTime(event.at) !== null) continue;
    const anchor = events.reduce((max, other) => {
      if (MOVEMENT_ORDER[other.type] >= MOVEMENT_ORDER[event.type]) return max;
      return Math.max(max, other.sortAt);
    }, 0);
    event.sortAt = anchor + MOVEMENT_ORDER[event.type];
  }

  return events
    .sort((a, b) => b.sortAt - a.sortAt || MOVEMENT_ORDER[b.type] - MOVEMENT_ORDER[a.type])
    .map(({ sortAt: _sortAt, ...event }) => event);
}

function campaignFlow(campaign: Campaign) {
  return campaign.approval_flow || "script_and_video";
}

function planningFlow(item: PlanningItem) {
  return item.approval_flow || "script_and_video";
}

function stageStatus(
  status: string | null | undefined,
  viewedAt: string | null,
  deadline?: string | null,
  opts?: { resubmission?: boolean; submittedAt?: string | null; month?: string | null },
): DeliveryStatus {
  if (status === "approved" || status === "published") return "approved";
  if (status === "revision") return "revision_requested";
  const submitted = status === "submitted" || status === "sent" || status === "review";
  if (submitted) {
    if (submittedAfterDeadline(opts?.submittedAt, deadline)) return "overdue";
    if (opts?.resubmission) return viewedAt ? "new_version" : "unread";
    return viewedAt ? "pending_approval" : "unread";
  }
  if (isDateBeforeToday(deadline)) return "overdue";
  if (!deadline && opts?.month && opts.month < isoToday().slice(0, 7)) return "overdue";
  return viewedAt ? "pending_approval" : "unread";
}

type CampaignInboxDemand = {
  id: number;
  contentType: string;
  position: number;
  total: number;
  pauta?: string | null;
};

function buildCampaignStageItem(
  campaign: Campaign,
  row: CampaignCreator,
  stage: "script" | "video",
  opts: { part: 1 | 2; total: 1 | 2 },
  demand?: CampaignInboxDemand,
): DeliveryInboxItem {
  const id = demand ? `campaign-${row.id}-d${demand.id}-${stage}` : `campaign-${row.id}-${stage}`;
  const creatorName = creatorLabel(row.creator);
  const companyName = campaign.company?.name ?? "—";
  const formatLabel = demand?.contentType || row.delivery_type?.trim() || "UGC";
  const isScript = stage === "script";
  const stageStatusValue = isScript ? row.script_status : row.video_status;
  const createdAt = submissionAt(
    isScript ? row.script_submitted_at : row.video_submitted_at,
    row.script_submitted_at,
    row.video_submitted_at,
  );
  const resubmission = isScript
    ? ((row.content?.script_version ?? 0) > 1 || Boolean(row.script_feedback?.trim()))
    : ((row.content?.video_version ?? 0) > 1 || Boolean(row.video_feedback?.trim()));
  const status = stageStatus(stageStatusValue, null, row.delivery_date || campaign.delivery_date, {
    resubmission,
    submittedAt: createdAt.startsWith("1970") ? null : createdAt,
  });
  const contentType: DeliveryContentType = isScript ? "script" : mapCampaignContentType(row);
  const scriptFileUrl = row.content?.script_file_url || null;
  const scriptFileName = row.content?.script_file_name || fileNameFromUrl(scriptFileUrl);
  const fileUrl = isScript ? scriptFileUrl : (row.content?.video_url || row.content?.image_url || null);
  const history = (row.content?.submission_versions ?? []).filter((entry) => entry.stage === stage);
  const versions: DeliveryVersion[] = history.length > 0
    ? history.map((entry) => {
      const entryFileUrl = isScript
        ? (entry.script_file_url || scriptFileUrl)
        : (entry.video_url || fileUrl);
      return {
        id: `${id}-v${entry.version}`,
        versionNumber: entry.version,
        createdAt: entry.submitted_at || createdAt,
        status: entry.version === (isScript ? row.content?.script_version : row.content?.video_version) ? status : "approved" as DeliveryStatus,
        fileUrl: entryFileUrl,
        thumbnailUrl: row.content?.image_url || campaign.image_url || null,
        fileName: (isScript ? (entry.script_file_name || scriptFileName) : null) || fileNameFromUrl(entryFileUrl),
        scriptText: isScript ? (entry.script ?? row.content?.script ?? null) : null,
        linkUrl: !isScript ? (row.content?.published_link ?? null) : null,
        imageUrls: !isScript && row.content?.image_url ? [row.content.image_url] : undefined,
        creatorMessage: row.notes ?? null,
      };
    })
    : [{
      id: `${id}-v1`,
      versionNumber: 1,
      createdAt,
      status,
      fileUrl,
      thumbnailUrl: row.content?.image_url || campaign.image_url || null,
      fileName: (isScript ? scriptFileName : null) || fileNameFromUrl(fileUrl),
      scriptText: isScript ? (row.content?.script ?? null) : null,
      linkUrl: !isScript ? (row.content?.published_link ?? null) : null,
      imageUrls: !isScript && row.content?.image_url ? [row.content.image_url] : undefined,
      creatorMessage: row.notes ?? null,
    }];
  const currentVersion = isScript
    ? (row.content?.script_version || versions[versions.length - 1]?.versionNumber || 1)
    : (row.content?.video_version || versions[versions.length - 1]?.versionNumber || 1);

  const activity: DeliveryActivity[] = [];
  const videoFeedback = row.video_feedback?.trim() || "";
  const revisionDetails = row.revision_details?.trim() || "";
  const movements = buildDeliveryMovements({
    scriptStatus: row.script_status,
    videoStatus: row.video_status,
    deliveryStatus: row.delivery_status,
    scriptSubmittedAt: row.script_submitted_at,
    videoSubmittedAt: row.video_submitted_at,
    versions: row.content?.submission_versions,
    revisions: row.content?.revision_history,
    scriptFeedback: row.script_feedback,
    videoFeedback: videoFeedback || (revisionDetails && revisionDetails !== row.script_feedback?.trim() ? revisionDetails : ""),
    movements: row.content?.movements,
  });

  const revisions = revisionNotes(
    row.content?.revision_history,
    stage,
    isScript ? row.script_feedback : (row.video_feedback || row.revision_details),
    createdAt,
    id,
  );

  return {
    id,
    title: campaign.name,
    formatLabel,
    formatKey: (demand?.contentType || formatLabel).toLowerCase() || null,
    creatorId: String(row.creator_id),
    creatorName,
    creatorPhoto: row.creator?.photo_url,
    companyId: String(campaign.company_id),
    companyName,
    sourceType: "campaign",
    sourceId: String(campaign.id),
    sourceName: campaign.name,
    contentType,
    status,
    createdAt,
    viewedAt: null,
    approvalDeadline: row.delivery_date || campaign.delivery_date || null,
    publicationDate: row.post_date ?? campaign.end_date,
    responsibleUserName: "Rocketz",
    currentVersion,
    versions,
    activity,
    revisions,
    movements,
    participationId: row.id,
    demandId: demand?.id ?? null,
    demandPosition: demand?.position ?? null,
    demandTotal: demand?.total ?? null,
    planningItemId: null,
    approvalStage: stage,
    stagePart: opts.part,
    stageTotal: opts.total,
    period: (row.delivery_date || campaign.delivery_date || campaign.end_date || "").slice(0, 7) || null,
    brief: demand?.pauta?.trim() || null,
  };
}

function campaignDemandIdentity(demand: CampaignDemand): CampaignInboxDemand {
  return {
    id: demand.id,
    contentType: demand.content_type,
    position: demand.position,
    total: demand.total,
    pauta: demand.pauta,
  };
}

function campaignCreatorSent(row: CampaignCreator) {
  return Boolean(
    row.script_submitted_at
    || row.video_submitted_at
    || row.content?.video_url?.trim()
    || row.content?.image_url?.trim()
    || row.content?.published_link?.trim()
    || (row.content?.submission_versions?.length ?? 0) > 0
  );
}

function campaignStageHasScript(row: CampaignCreator) {
  const versions = row.content?.submission_versions ?? [];
  return Boolean(
    row.script_submitted_at
    || row.content?.script?.trim()
    || row.content?.script_file_url?.trim()
    || versions.some((entry) => entry.stage === "script" && Boolean(entry.script?.trim() || entry.script_file_url?.trim()))
  );
}

function demandScriptBody(demand: CampaignDemand) {
  const versions = demand.content?.submission_versions ?? [];
  return Boolean(
    demand.script_submitted_at
    || demand.content?.script?.trim()
    || demand.content?.script_file_url?.trim()
    || versions.some((entry) => entry.stage === "script" && Boolean(entry.script?.trim() || entry.script_file_url?.trim()))
  );
}

/** A pauta lives on the demand. A script sent before that slot existed stays on the participation. */
function withLegacyScript(row: CampaignCreator, demand: CampaignDemand, projected: CampaignCreator): CampaignCreator {
  if (demandScriptBody(demand) || !campaignStageHasScript(row)) return projected;
  const host = row.demands?.find((item) => !demandScriptBody(item));
  if (!host || host.id !== demand.id) return projected;
  const parentStatus = row.script_status && row.script_status !== "pending" ? row.script_status : null;
  return {
    ...projected,
    script_status: parentStatus || projected.script_status,
    script_submitted_at: projected.script_submitted_at || row.script_submitted_at || null,
    content: {
      video_url: projected.content?.video_url ?? null,
      image_url: projected.content?.image_url ?? null,
      published_link: projected.content?.published_link ?? null,
      ...(projected.content ?? {}),
      script: row.content?.script ?? projected.content?.script ?? null,
      script_file_url: row.content?.script_file_url || projected.content?.script_file_url,
      script_file_name: row.content?.script_file_name || projected.content?.script_file_name,
      script_version: row.content?.script_version || projected.content?.script_version,
      submission_versions: projected.content?.submission_versions?.length
        ? projected.content.submission_versions
        : row.content?.submission_versions,
    },
  };
}

function campaignStageHasVideo(row: CampaignCreator) {
  return Boolean(
    row.video_submitted_at
    || row.content?.video_url?.trim()
    || row.content?.image_url?.trim()
    || row.content?.published_link?.trim()
  );
}

function planningCreatorSent(item: PlanningItem) {
  return Boolean(
    item.script_submitted_at
    || item.video_submitted_at
    || item.submitted_at
    || item.media_url?.trim()
    || item.submission_url?.trim()
    || item.published_url?.trim()
    || (item.submission_versions?.length ?? 0) > 0
  );
}

function fromCampaign(campaign: Campaign, row: CampaignCreator): DeliveryInboxItem[] {
  if (row.application_status && row.application_status !== "approved") return [];

  if (row.demands?.length) {
    return row.demands.flatMap((demand) => fromCampaignSubmission(
      campaign,
      withLegacyScript(row, demand, {
        ...projectDemand(row, demand),
        creator: row.creator,
        creator_id: row.creator_id,
        delivery_type: demand.content_type,
      }),
      campaignDemandIdentity(demand),
    ));
  }

  return fromCampaignSubmission(campaign, row);
}

function fromCampaignSubmission(campaign: Campaign, row: CampaignCreator, demand?: CampaignInboxDemand): DeliveryInboxItem[] {
  const flow = campaignFlow(campaign);
  const items: DeliveryInboxItem[] = [];
  const staged = flow === "script_and_video";
  const scriptOnly = flow === "script_only";
  const videoOnly = flow === "video_only";

  if (staged || scriptOnly) {
    const hasScriptMaterial = campaignStageHasScript(row);
    const scriptSent = row.script_status === "submitted" || row.script_status === "revision";
    const scriptNeedsDecision = hasScriptMaterial && row.script_status !== "approved";
    const scriptApprovedBeforeVideo = hasScriptMaterial && row.script_status === "approved" && !campaignStageHasVideo(row);
    if (scriptSent || scriptNeedsDecision || scriptApprovedBeforeVideo) {
      items.push(buildCampaignStageItem(campaign, row, "script", { part: 1, total: staged ? 2 : 1 }, demand));
    }
  }

  const scriptReady = scriptOnly
    ? false
    : staged
      ? row.script_status === "approved"
      : true;

  if ((staged && scriptReady) || videoOnly || flow === "live_link" || (!staged && !scriptOnly)) {
    const hasVideoMaterial = campaignStageHasVideo(row);
    const creatorSentVideo = hasVideoMaterial && (
      row.video_status === "submitted"
      || row.video_status === "revision"
      || (row.delivery_status === "sent" && row.video_status !== "approved")
    );
    if (creatorSentVideo) {
      items.push(buildCampaignStageItem(campaign, row, "video", { part: staged ? 2 : 1, total: staged ? 2 : 1 }, demand));
    }
  }

  // Fully done records still appear in approved folder
  const fullyApproved = row.delivery_status === "approved"
    || row.delivery_status === "published"
    || (staged && row.script_status === "approved" && row.video_status === "approved")
    || (scriptOnly && row.script_status === "approved")
    || (videoOnly && row.video_status === "approved");

  if (fullyApproved && items.length === 0 && campaignCreatorSent(row)) {
    const doneStage = scriptOnly ? "script" : "video";
    const done = buildCampaignStageItem(campaign, row, doneStage, { part: staged ? 2 : 1, total: staged ? 2 : 1 }, demand);
    done.status = "approved";
    done.id = demand ? `campaign-${row.id}-d${demand.id}-done` : `campaign-${row.id}-done`;
    items.push(done);
  }

  return items;
}

function mapCampaignContentType(row: CampaignCreator): DeliveryContentType {
  if (row.content?.published_link && !row.content?.video_url && !row.content?.image_url && !row.content?.script && !row.content?.script_file_url) {
    return "link";
  }
  if ((row.content?.script || row.content?.script_file_url) && !row.content?.video_url && !row.content?.image_url) return "script";
  if (row.content?.image_url && !row.content?.video_url) return "image";
  const fromType = mapContentType(row.delivery_type);
  if (fromType !== "other") return fromType;
  if (row.content?.video_url) return "video";
  return "other";
}

function buildPlanningStageItem(
  contract: RecurringContract,
  item: PlanningItem,
  stage: "script" | "video",
  opts: { part: 1 | 2; total: 1 | 2 },
): DeliveryInboxItem {
  const id = `recurring-${item.id}-${stage}`;
  const creatorName = creatorLabel(item.creator);
  const companyName = item.company?.name || contract.company?.name || "—";
  const formatLabel = item.content_type || "UGC";
  const isScript = stage === "script";
  const stageStatusValue = isScript ? item.script_status : item.video_status;
  const createdAt = submissionAt(
    isScript ? item.script_submitted_at : item.video_submitted_at,
    item.submitted_at,
    item.script_submitted_at,
    item.video_submitted_at,
  );
  const resubmission = isScript
    ? ((item.script_version ?? 0) > 1 || Boolean(item.script_feedback?.trim()))
    : ((item.video_version ?? 0) > 1 || Boolean((item.video_feedback || item.feedback_note)?.trim()));
  const dueDate = effectivePlanningDueDate(item);
  const status = stageStatus(
    stageStatusValue ?? (item.status === "review" ? "submitted" : item.status),
    null,
    dueDate,
    { resubmission, submittedAt: createdAt.startsWith("1970") ? null : createdAt, month: item.month },
  );
  const scriptFileUrl = item.script_file_url || null;
  const scriptFileName = item.script_file_name || fileNameFromUrl(scriptFileUrl);
  const fileUrl = isScript ? scriptFileUrl : (item.media_url || item.submission_url || null);
  const history = (item.submission_versions ?? []).filter((entry) => entry.stage === stage);
  const versions: DeliveryVersion[] = history.length > 0
    ? history.map((entry) => {
      const entryFileUrl = isScript
        ? (entry.script_file_url || scriptFileUrl)
        : (entry.media_url || entry.submission_url || fileUrl);
      return {
        id: `${id}-v${entry.version}`,
        versionNumber: entry.version,
        createdAt: entry.submitted_at || createdAt,
        status: entry.version === (isScript ? item.script_version : item.video_version) ? status : "approved" as DeliveryStatus,
        fileUrl: entryFileUrl,
        fileName: (isScript ? (entry.script_file_name || scriptFileName) : null) || fileNameFromUrl(entryFileUrl),
        scriptText: isScript ? (entry.script ?? item.script ?? null) : null,
        captionText: item.caption ?? null,
        linkUrl: !isScript ? (item.published_url || item.submission_url || null) : null,
        creatorMessage: item.submission_notes ?? null,
      };
    })
    : [{
      id: `${id}-v1`,
      versionNumber: 1,
      createdAt,
      status,
      fileUrl,
      fileName: (isScript ? scriptFileName : null) || fileNameFromUrl(fileUrl),
      scriptText: isScript ? (item.script ?? null) : null,
      captionText: item.caption ?? null,
      linkUrl: !isScript ? (item.published_url || item.submission_url || null) : null,
      creatorMessage: item.submission_notes ?? null,
    }];
  const currentVersion = isScript
    ? (item.script_version || versions[versions.length - 1]?.versionNumber || 1)
    : (item.video_version || versions[versions.length - 1]?.versionNumber || 1);

  const activity: DeliveryActivity[] = [];
  const movements = buildDeliveryMovements({
    scriptStatus: item.script_status,
    videoStatus: item.video_status,
    deliveryStatus: item.status,
    scriptSubmittedAt: item.script_submitted_at,
    videoSubmittedAt: item.video_submitted_at || (item.media_url || item.submission_url ? item.submitted_at : null),
    reviewedAt: item.reviewed_at,
    versions: item.submission_versions,
    revisions: item.revision_history,
    scriptFeedback: item.script_feedback,
    videoFeedback: item.video_feedback || item.feedback_note,
    movements: item.movements,
  });

  const revisions = revisionNotes(
    item.revision_history,
    stage,
    isScript ? item.script_feedback : (item.video_feedback || item.feedback_note),
    item.reviewed_at || createdAt,
    id,
  );

  return {
    id,
    title: namedPlanningTitle(item.title),
    formatLabel: item.content_type || "UGC",
    formatKey: item.content_type || null,
    creatorId: String(item.creator_id),
    creatorName,
    creatorPhoto: item.creator?.photo_url,
    companyId: String(item.company_id ?? contract.company_id),
    companyName,
    sourceType: "recurring",
    sourceId: String(contract.id),
    sourceName: contract.title,
    contentType: isScript ? "script" : mapContentType(item.content_type),
    status,
    createdAt,
    viewedAt: null,
    approvalDeadline: dueDate,
    publicationDate: item.post_date ?? item.planned_date,
    responsibleUserName: "Rocketz",
    currentVersion,
    versions,
    activity,
    revisions,
    movements,
    participationId: null,
    planningItemId: item.id,
    approvalStage: stage,
    stagePart: opts.part,
    stageTotal: opts.total,
    period: (item.month || item.planned_date || "").slice(0, 7) || null,
  };
}

function fromPlanningItem(contract: RecurringContract, item: PlanningItem): DeliveryInboxItem[] {
  const flow = planningFlow(item);
  const items: DeliveryInboxItem[] = [];
  const staged = flow === "script_and_video";
  const scriptOnly = flow === "script_only";
  const videoOnly = flow === "video_only";
  const live = flow === "live_link";

  if (staged || scriptOnly) {
    const hasScriptMaterial = Boolean(item.script_submitted_at || item.script?.trim() || item.script_file_url?.trim());
    if (hasScriptMaterial && (item.script_status === "submitted" || item.script_status === "revision" || item.script_status !== "approved")) {
      items.push(buildPlanningStageItem(contract, item, "script", { part: 1, total: staged ? 2 : 1 }));
    }
  }

  const scriptReady = staged ? item.script_status === "approved" : true;

  if ((staged && scriptReady) || videoOnly || live || (!staged && !scriptOnly)) {
    const hasVideoMaterial = Boolean(
      item.video_submitted_at
      || item.media_url?.trim()
      || item.submission_url?.trim()
      || item.published_url?.trim()
    );
    const videoPending = hasVideoMaterial && (
      item.video_status === "submitted"
      || item.video_status === "revision"
      || (item.status === "review" && item.script_status !== "submitted")
    );
    if (videoPending) {
      items.push(buildPlanningStageItem(contract, item, "video", { part: staged ? 2 : 1, total: staged ? 2 : 1 }));
    }
  }

  const creatorSent = planningCreatorSent(item);

  // Fallback: legacy review without stage fields
  if (items.length === 0 && creatorSent && (item.status === "review" || item.submitted_at)) {
    const stage = (item.script || item.script_file_url) && !item.media_url ? "script" : "video";
    items.push(buildPlanningStageItem(contract, item, stage, { part: staged ? (stage === "script" ? 1 : 2) : 1, total: staged ? 2 : 1 }));
  }

  const fullyApproved = item.status === "approved"
    || item.status === "published"
    || (staged && item.script_status === "approved" && item.video_status === "approved");

  if (fullyApproved && items.length === 0 && creatorSent) {
    const done = buildPlanningStageItem(contract, item, "video", { part: staged ? 2 : 1, total: staged ? 2 : 1 });
    done.status = "approved";
    done.id = `recurring-${item.id}-done`;
    items.push(done);
  }

  if (items.length === 0 && creatorSent && (item.status === "rejected" || (item.status === "in_production" && item.feedback_note))) {
    const stage = item.script_status === "revision" ? "script" : "video";
    items.push(buildPlanningStageItem(contract, item, stage, { part: staged ? (stage === "script" ? 1 : 2) : 1, total: staged ? 2 : 1 }));
  }

  return items;
}

export function buildDeliveryInboxFromApi(
  campaigns: Campaign[],
  recurring: RecurringContract[],
): DeliveryInboxItem[] {
  const items: DeliveryInboxItem[] = [];

  for (const campaign of campaigns) {
    for (const row of campaign.applications ?? []) {
      items.push(...fromCampaign(campaign, row));
    }
  }

  for (const contract of recurring) {
    for (const item of contract.items ?? []) {
      items.push(...fromPlanningItem(contract, item));
    }
  }

  return applyLocalMeta(dedupeInboxItems(items)).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function dedupeInboxItems(items: DeliveryInboxItem[]): DeliveryInboxItem[] {
  const byId = new Map<string, DeliveryInboxItem>();
  for (const item of items) {
    const previous = byId.get(item.id);
    if (!previous || +new Date(item.createdAt) >= +new Date(previous.createdAt)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

export function isUnread(item: DeliveryInboxItem) {
  return !item.viewedAt || item.status === "unread";
}

/** Creator actually sent a file, script, caption or link. The demand brief is not material. */
export function inboxHasMaterial(item: Pick<DeliveryInboxItem, "versions">) {
  return item.versions.some((version) => Boolean(
    version.fileUrl
    || version.scriptText?.trim()
    || version.linkUrl
    || version.captionText?.trim()
    || version.imageUrls?.length,
  ));
}

/**
 * Opening a demand that is still waiting for the creator must not look like an approval.
 * Only a real submission moves from "nova" to "aguardando aprovação".
 */
export function statusAfterView(item: DeliveryInboxItem): DeliveryStatus {
  if (item.status !== "unread" || !inboxHasMaterial(item)) return item.status;
  return "pending_approval";
}

/** Still inside the delivery date and nothing was sent yet. */
export function isOnSchedule(item: DeliveryInboxItem) {
  if (item.archived || item.status === "approved" || item.status === "overdue" || item.status === "revision_requested") return false;
  if (!inboxHasMaterial(item)) {
    return !isDateBeforeToday(item.approvalDeadline || item.publicationDate);
  }
  return false;
}

/** Opened (or overdue) and still waiting for approve/revision. */
export function needsAction(item: DeliveryInboxItem) {
  if (item.archived) return false;
  if (!inboxHasMaterial(item)) return item.status === "overdue";
  return ["pending_approval", "new_version", "overdue"].includes(item.status);
}

export function matchesFolder(item: DeliveryInboxItem, folder: InboxFolder) {
  if (folder === "all") return !item.archived;
  if (folder === "archived") return Boolean(item.archived) || item.status === "archived";
  if (folder === "unread") return !item.archived && !isOnSchedule(item) && isUnread(item);
  if (folder === "on_track") return !item.archived && isOnSchedule(item);
  if (folder === "overdue") return !item.archived && item.status === "overdue";
  if (folder === "pending_approval") {
    return !item.archived && !isOnSchedule(item) && (item.status === "pending_approval" || item.status === "new_version" || item.status === "unread");
  }
  return !item.archived && item.status === folder;
}

export function countByFolder(items: DeliveryInboxItem[], folder: InboxFolder) {
  return items.filter((item) => matchesFolder(item, folder)).length;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dateGroupKey(isoDate: string): "today" | "yesterday" | "week" | "older" {
  const date = startOfDay(new Date(isoDate));
  const today = startOfDay(new Date());
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff > 1 && diff < 7) return "week";
  return "older";
}

export function formatInboxTime(isoDate: string, locale: string) {
  const date = new Date(isoDate);
  const group = dateGroupKey(isoDate);
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (group === "today") return time;
  if (group === "yesterday") return time;
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

export function formatInboxPeriod(period?: string | null, locale = "pt-BR") {
  if (!period) return null;
  const iso = period.length === 7 ? `${period}-01T12:00:00` : `${period.slice(0, 10)}T12:00:00`;
  const date = new Date(iso);
  if (Number.isNaN(+date)) return period;
  return date.toLocaleDateString(locale, { month: "short", year: "numeric" });
}
