"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { safeHttpUrl } from "@/lib/safe-http-url";
import { AlertTriangle, CheckCircle2, Link2, RefreshCw, Send, X } from "lucide-react";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { VideoSubmissionFields } from "@/components/VideoSubmissionFields";
import { useOptionalUploadManager } from "@/contexts/UploadManagerContext";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import type { PlanningItem } from "@/lib/types";
import { mergeUploadProgress } from "@/lib/content-delivery-status";
import { isBrandPosting } from "@/lib/posting-profile";

type Props = {
  item: PlanningItem;
  onSubmitted: () => void;
};

export function CreatorPautaSubmissionPanel({ item, onSubmitted }: Props) {
  const { t } = useTranslation("app");
  const { t: tp } = useTranslation("profile");
  const uploadManager = useOptionalUploadManager();

  const flow = item.approval_flow || "script_and_video";
  const staged = flow === "script_and_video";
  const videoOnly = flow === "video_only";
  const done = item.status === "approved" || item.status === "published";

  const scriptApproved = item.script_status === "approved";
  const scriptSubmitted = item.script_status === "submitted";
  const videoApproved = item.video_status === "approved";
  const videoSubmitted = item.video_status === "submitted";
  const scriptRevision = item.script_status === "revision";
  const videoRevision = item.video_status === "revision";
  const hasRevision = scriptRevision || videoRevision;
  const awaitingScriptApproval = staged && scriptSubmitted && !scriptApproved;
  const awaitingVideoApproval = videoSubmitted && !videoApproved && !videoRevision;
  const canSubmitScript = staged && !scriptApproved && item.script_status !== "submitted";
  const canSubmitVideoBase = (staged && scriptApproved && !videoApproved)
    || (videoOnly && !videoApproved && item.status !== "approved")
    || (!staged && !videoOnly && flow !== "live_link" && !done);
  const canSubmitVideo = canSubmitVideoBase && !awaitingVideoApproval && (videoRevision || !videoSubmitted);

  const [script, setScript] = useState(item.script || "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [publishedUrl, setPublishedUrl] = useState(item.published_url || "");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const currentVideoVersion = item.video_version ?? 0;
  const currentScriptVersion = item.script_version ?? 0;
  const nextVideoVersion = currentVideoVersion + 1;
  const nextScriptVersion = currentScriptVersion + 1;
  const scriptChanged = script.trim() !== (item.script || "").trim();
  const requiresNewVideoFile = videoRevision;
  const requiresScriptChange = scriptRevision;
  const alreadyPublished = item.status === "published" && Boolean(item.published_url?.trim());
  const materialApproved = item.status === "approved" || item.video_status === "approved";
  const awaitingPublishUrl = !alreadyPublished && (materialApproved || flow === "live_link");
  const brandPosts = isBrandPosting(item.posting_profile);
  const remoteUploadProgress = mergeUploadProgress(
    item.upload_progress,
    uploadManager?.getSubjectProgress("content_planning_item", item.id),
  );
  const isBackgroundUploading = Boolean(item.pending_upload_id) || Boolean(uploadManager?.isSubjectUploading("content_planning_item", item.id));

  async function submitPublishedUrl() {
    if (!publishedUrl.trim()) {
      await alertWarning(tp("materialRequiredTitle"), tp("publishedLinkRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await api.updatePlanningItem(item.id, { published_url: publishedUrl.trim() });
      await alertSuccess(tp("publishedLinkSent"));
      onSubmitted();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (canSubmitScript) {
      if (!script.trim()) {
        await alertWarning(tp("materialRequiredTitle"), tp("scriptRequired"));
        return;
      }
      if (requiresScriptChange && !scriptChanged) {
        await alertWarning(tp("materialRequiredTitle"), tp("scriptChangeRequired"));
        return;
      }
    } else if (canSubmitVideo) {
      if (requiresNewVideoFile && !videoFile && !downloadUrl.trim()) {
        await alertWarning(tp("materialRequiredTitle"), tp("newVideoFileRequired"));
        return;
      }
      if (!videoFile && !downloadUrl.trim() && !item.media_url && !item.submission_url) {
        await alertWarning(tp("materialRequiredTitle"), tp("videoOrLinkRequired"));
        return;
      }
      if (downloadUrl.trim() && !safeHttpUrl(downloadUrl.trim())) {
        await alertWarning(tp("materialRequiredTitle"), tp("downloadLinkInvalid"));
        return;
      }
    } else {
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    try {
      if (canSubmitVideo && videoFile) {
        if (uploadManager) {
          uploadManager.startSubmissionUpload(
            videoFile,
            videoFile.name,
            {
              type: "content_planning_item",
              id: item.id,
              label: item.title || t("recurringDetail.quotaAwaiting"),
              payload: {
                status: "review",
                video_status: "submitted",
              },
            },
            setUploadProgress,
          );
          await alertSuccess(tp("uploadStarted"), tp("uploadStartedHint"));
          setVideoFile(null);
          onSubmitted();
          return;
        }
      }

      const externalVideoUrl = safeHttpUrl(downloadUrl.trim());
      if (canSubmitVideo && externalVideoUrl && !videoFile) {
        await api.updatePlanningItem(item.id, {
          status: "review",
          media_url: externalVideoUrl,
          submission_url: externalVideoUrl,
          video_status: "submitted",
        });
        await alertSuccess(hasRevision ? tp("newVersionSent") : tp("materialSent"));
        setDownloadUrl("");
        onSubmitted();
        return;
      }

      const body: Record<string, unknown> = { status: "review" };
      if (canSubmitScript) {
        body.script = script.trim();
        body.script_status = "submitted";
      } else if (canSubmitVideo) {
        let mediaUrl = item.media_url || item.submission_url || null;
        if (videoFile) {
          const uploaded = await api.uploadMedia(videoFile, videoFile.name, setUploadProgress);
          mediaUrl = uploaded.data.url;
        }
        body.media_url = mediaUrl;
        body.submission_url = mediaUrl;
        body.video_status = "submitted";
      }
      await api.updatePlanningItem(item.id, body);
      await alertSuccess(
        hasRevision
          ? tp("newVersionSent")
          : canSubmitScript && staged
            ? tp("scriptSentWaiting")
            : tp("materialSent"),
      );
      onSubmitted();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  }

  async function cancelVideoUpload() {
    await uploadManager?.cancelSubjectUpload("content_planning_item", item.id, item.pending_upload_id);
    setSubmitting(false);
    setUploadProgress(0);
  }

  const scriptReady = canSubmitScript
    ? Boolean(script.trim()) && (!requiresScriptChange || scriptChanged)
    : false;
  const videoReady = canSubmitVideo
    ? (requiresNewVideoFile
      ? Boolean(videoFile || downloadUrl.trim())
      : Boolean(videoFile || downloadUrl.trim() || item.media_url || item.submission_url))
    : false;
  const disabled = submitting
    || isBackgroundUploading
    || awaitingScriptApproval
    || (canSubmitScript ? !scriptReady : canSubmitVideo ? !videoReady : true);
  const uploadingVideo = (submitting && Boolean(videoFile) && canSubmitVideo) || isBackgroundUploading;
  const displayProgress = remoteUploadProgress ?? uploadProgress;

  const revisionNote = scriptRevision
    ? (item.script_feedback || "")
    : videoRevision
      ? (item.video_feedback || item.feedback_note || "")
      : "";

  if (alreadyPublished) {
    return item.published_url ? (
      <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="m-0 text-[10px] font-extrabold tracking-wider text-emerald-800 uppercase">{tp("publishedLinkLabel")}</p>
        <a href={safeHttpUrl(item.published_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 truncate text-xs font-bold text-emerald-800 hover:underline">
          <Link2 size={13} /> {item.published_url}
        </a>
      </div>
    ) : null;
  }

  if (awaitingPublishUrl) {
    if (brandPosts) {
      return (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="m-0 text-[11px] font-medium text-amber-900">{tp("approvedPublishHintBrand")}</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="m-0 text-[11px] font-medium text-emerald-800">{tp("approvedPublishHint")}</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{tp("publishedLinkLabel")}</label>
          <input
            type="url"
            placeholder={tp("publishedLinkPh")}
            value={publishedUrl}
            onChange={(event) => setPublishedUrl(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs outline-none focus:border-brand-primary"
          />
        </div>
        <button
          type="button"
          disabled={submitting || !publishedUrl.trim()}
          onClick={() => void submitPublishedUrl()}
          className={cn(
            "inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-[11px] font-bold tracking-wider uppercase transition-all disabled:cursor-not-allowed",
            submitting || !publishedUrl.trim() ? "bg-slate-100 text-slate-400" : "bg-emerald-600 text-white hover:bg-emerald-700",
          )}
        >
          <Link2 size={14} /> {tp("sendPublishedLink")}
        </button>
      </div>
    );
  }

  if (done || flow === "live_link") return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold tracking-wider text-indigo-800 uppercase">
        <Send size={12} />
        {staged ? t("recurringDetail.pautaSubmitStaged") : t("recurringDetail.pautaSubmitVideo")}
        {(canSubmitVideo || awaitingVideoApproval) && currentVideoVersion > 0 ? (
          <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[9px] font-black text-indigo-700">
            {tp("versionBadge", { n: currentVideoVersion })}
          </span>
        ) : null}
        {(canSubmitScript || awaitingScriptApproval) && currentScriptVersion > 0 ? (
          <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[9px] font-black text-indigo-700">
            {tp("versionBadge", { n: currentScriptVersion })}
          </span>
        ) : null}
      </div>

      {hasRevision ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-black text-rose-900">{tp("revisionAlertTitle")}</p>
              <p className="mt-0.5 mb-0 text-[11px] font-semibold text-rose-800/90">{tp("revisionAlertHint")}</p>
            </div>
          </div>
          {revisionNote ? (
            <div className="rounded-xl border border-rose-200 bg-white/90 px-3 py-2.5">
              <span className="mb-1 block text-[9px] font-extrabold tracking-wider text-rose-600 uppercase">{tp("revisionFeedbackLabel")}</span>
              <p className="m-0 text-xs leading-relaxed font-semibold whitespace-pre-wrap text-slate-800">{revisionNote}</p>
            </div>
          ) : null}
          <p className="m-0 flex items-center gap-1.5 text-[11px] font-bold text-rose-900">
            <RefreshCw size={12} /> {tp("revisionSendNewVersionHint")}
          </p>
          {videoRevision ? (
            <p className="m-0 text-[11px] font-semibold text-rose-800">
              {tp("newVideoFileRequiredHint", { n: nextVideoVersion })}
            </p>
          ) : null}
        </div>
      ) : null}

      {awaitingScriptApproval ? (
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-900">
          {tp("waitingScriptApproval")}
        </p>
      ) : null}

      {awaitingVideoApproval ? (
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-900">
          {tp("waitingVideoApproval")}
        </p>
      ) : null}

      {staged && scriptApproved && !videoApproved && !videoRevision && !awaitingVideoApproval && !done ? (
        <p className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-semibold text-emerald-900">
          {tp("scriptApprovedSendVideo")}
        </p>
      ) : null}

      {(canSubmitScript || awaitingScriptApproval || (staged && Boolean(item.script))) ? (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{tp("scriptLabel")}</label>
          <textarea
            rows={3}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            disabled={!canSubmitScript || awaitingScriptApproval}
            placeholder={tp("scriptPh")}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-brand-primary disabled:opacity-60"
          />
        </div>
      ) : null}

      {canSubmitVideo ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{tp("videoLabel")}</label>
          <VideoSubmissionFields
            compact
            file={videoFile}
            downloadUrl={downloadUrl}
            onFileSelect={setVideoFile}
            onDownloadUrlChange={setDownloadUrl}
            disabled={submitting || isBackgroundUploading}
            versionBadge={hasRevision ? tp("versionBadge", { n: nextVideoVersion }) : null}
            requiresNewFile={requiresNewVideoFile}
            showPreviousAttached={Boolean(!videoFile && !downloadUrl.trim() && (item.media_url || item.submission_url))}
            attachedHint={requiresNewVideoFile ? tp("previousVideoAttachedSelectNew") : t("recurringDetail.pautaVideoAttached")}
          />
        </div>
      ) : awaitingVideoApproval && (item.media_url || item.submission_url) ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{tp("videoLabel")}</label>
          <span className="truncate text-[10px] font-semibold text-emerald-700">{t("recurringDetail.pautaVideoAttached")}</span>
        </div>
      ) : null}

      {!awaitingScriptApproval && !awaitingVideoApproval && (canSubmitScript || canSubmitVideo) ? (
        uploadingVideo ? (
          <div className="flex flex-col gap-2">
            <UploadProgressBar progress={displayProgress ?? 0} />
            <button
              type="button"
              onClick={() => void cancelVideoUpload()}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-[11px] font-bold tracking-wider text-white uppercase shadow-sm transition-all hover:bg-rose-700"
            >
              <X size={14} />
              {tp("cancelUpload")}
            </button>
          </div>
        ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void submit()}
          className={cn(
            "inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-[11px] font-bold tracking-wider uppercase transition-all disabled:cursor-not-allowed",
            disabled
              ? "bg-slate-100 text-slate-400"
              : hasRevision
                ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                : "bg-brand-primary text-white hover:bg-indigo-600",
          )}
        >
          {hasRevision ? <RefreshCw size={14} /> : <CheckCircle2 size={14} />}
          {hasRevision
            ? tp("sendNewVersionNumbered", { n: canSubmitVideo ? nextVideoVersion : nextScriptVersion })
            : canSubmitScript && staged
              ? tp("sendScriptForReview")
              : tp("sendForReview")}
        </button>
        )
      ) : null}
    </div>
  );
}
