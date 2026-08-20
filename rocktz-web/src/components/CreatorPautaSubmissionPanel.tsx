"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, RefreshCw, Send, UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import type { PlanningItem } from "@/lib/types";

type Props = {
  item: PlanningItem;
  onSubmitted: () => void;
};

export function CreatorPautaSubmissionPanel({ item, onSubmitted }: Props) {
  const { t } = useTranslation("app");
  const { t: tp } = useTranslation("profile");
  const fileRef = useRef<HTMLInputElement>(null);

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
  const [submitting, setSubmitting] = useState(false);

  const currentVideoVersion = item.video_version ?? 0;
  const currentScriptVersion = item.script_version ?? 0;
  const nextVideoVersion = currentVideoVersion + 1;
  const nextScriptVersion = currentScriptVersion + 1;
  const scriptChanged = script.trim() !== (item.script || "").trim();
  const requiresNewVideoFile = videoRevision;
  const requiresScriptChange = scriptRevision;

  if (done || flow === "live_link") return null;

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
      if (requiresNewVideoFile && !videoFile) {
        await alertWarning(tp("materialRequiredTitle"), tp("newVideoFileRequired"));
        return;
      }
      if (!videoFile && !item.media_url && !item.submission_url) {
        await alertWarning(tp("materialRequiredTitle"), tp("videoRequired"));
        return;
      }
    } else {
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { status: "review" };
      if (canSubmitScript) {
        body.script = script.trim();
        body.script_status = "submitted";
      } else if (canSubmitVideo) {
        let mediaUrl = item.media_url || item.submission_url || null;
        if (videoFile) {
          const uploaded = await api.uploadMedia(videoFile, videoFile.name);
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
    }
  }

  const scriptReady = canSubmitScript
    ? Boolean(script.trim()) && (!requiresScriptChange || scriptChanged)
    : false;
  const videoReady = canSubmitVideo
    ? (requiresNewVideoFile ? Boolean(videoFile) : Boolean(videoFile || item.media_url || item.submission_url))
    : false;
  const disabled = submitting
    || awaitingScriptApproval
    || (canSubmitScript ? !scriptReady : canSubmitVideo ? !videoReady : true);

  const revisionNote = scriptRevision
    ? (item.script_feedback || "")
    : videoRevision
      ? (item.video_feedback || item.feedback_note || "")
      : "";

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
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*,.mp4,.mov,.webm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith("video/")) {
                  void alertWarning(tp("invalidVideoTitle"), tp("invalidVideo"));
                  e.target.value = "";
                  return;
                }
                if (file.size > 150 * 1024 * 1024) {
                  void alertWarning(tp("invalidVideoTitle"), tp("videoTooBig"));
                  e.target.value = "";
                  return;
                }
                setVideoFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-white px-3 text-[11px] font-bold text-slate-800 shadow-xs hover:bg-slate-50"
            >
              <UploadCloud size={13} /> {tp("chooseFile")}
            </button>
            {videoFile ? (
              <span className="truncate font-mono text-[10px] text-slate-600">
                {videoFile.name}
                {hasRevision ? ` · ${tp("versionBadge", { n: nextVideoVersion })}` : null}
              </span>
            ) : item.media_url || item.submission_url ? (
              <span className={cn("truncate text-[10px] font-semibold", requiresNewVideoFile ? "text-amber-700" : "text-emerald-700")}>
                {requiresNewVideoFile
                  ? tp("previousVideoAttachedSelectNew")
                  : t("recurringDetail.pautaVideoAttached")}
              </span>
            ) : null}
          </div>
        </div>
      ) : awaitingVideoApproval && (item.media_url || item.submission_url) ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{tp("videoLabel")}</label>
          <span className="truncate text-[10px] font-semibold text-emerald-700">{t("recurringDetail.pautaVideoAttached")}</span>
        </div>
      ) : null}

      {!awaitingScriptApproval && !awaitingVideoApproval && (canSubmitScript || canSubmitVideo) ? (
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
      ) : null}
    </div>
  );
}
