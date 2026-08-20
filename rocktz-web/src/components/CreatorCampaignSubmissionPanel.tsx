"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, ChevronUp, ExternalLink, FileText, Link2, RefreshCw, Send, UploadCloud, Video } from "lucide-react";
import { CampaignSubmittedVideo } from "@/components/CampaignSubmittedVideo";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import type { Campaign, CampaignCreator } from "@/lib/types";

function briefingText(campaign: Campaign, key: string) {
  const value = campaign.briefing?.[key];
  return typeof value === "string" && value.trim() ? value : "";
}

type Props = {
  campaign: Campaign;
  row: CampaignCreator;
  onClose: () => void;
  onSubmitted: () => void;
};

export function CreatorCampaignSubmissionPanel({ campaign, row, onClose, onSubmitted }: Props) {
  const { t: tp } = useTranslation("profile");
  const fileRef = useRef<HTMLInputElement>(null);

  const [briefingOpen, setBriefingOpen] = useState(true);
  const [script, setScript] = useState(row.content?.script || "");
  const [publishedUrl, setPublishedUrl] = useState(row.content?.published_link || "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isApproved = row.delivery_status === "approved";
  const flow = campaign.approval_flow || "script_and_video";
  const stagedFlow = flow === "script_and_video";
  const scriptApproved = row.script_status === "approved";
  const scriptSubmitted = row.script_status === "submitted";
  const videoApproved = row.video_status === "approved";
  const videoSubmitted = row.video_status === "submitted";
  const scriptRevision = row.script_status === "revision";
  const videoRevision = row.video_status === "revision";
  const deliveryRevision = row.delivery_status === "revision";
  const hasRevision = scriptRevision || videoRevision || deliveryRevision;
  const awaitingScriptApproval = stagedFlow && scriptSubmitted && !scriptApproved;
  const awaitingVideoApproval = videoSubmitted && !videoApproved && !videoRevision && !deliveryRevision;
  const canSubmitScript = (stagedFlow || flow === "script_only")
    && !scriptApproved
    && row.script_status !== "submitted";
  const canSubmitVideoBase = flow === "video_only"
    || flow === "live_link"
    || (stagedFlow && scriptApproved && !videoApproved)
    || (!stagedFlow && flow !== "script_only" && !isApproved);
  const canSubmitVideo = canSubmitVideoBase && !awaitingVideoApproval && (videoRevision || deliveryRevision || !videoSubmitted);
  const showScriptField = !isApproved
    && flow !== "video_only"
    && flow !== "live_link"
    && (canSubmitScript || awaitingScriptApproval || Boolean(row.content?.script) || scriptApproved);
  const currentVideoVersion = row.content?.video_version ?? 0;
  const currentScriptVersion = row.content?.script_version ?? 0;
  const nextVideoVersion = currentVideoVersion + 1;
  const nextScriptVersion = currentScriptVersion + 1;
  const scriptChanged = script.trim() !== (row.content?.script || "").trim();
  const requiresNewVideoFile = (videoRevision || deliveryRevision) && canSubmitVideo;
  const requiresScriptChange = scriptRevision && canSubmitScript;
  const product = briefingText(campaign, "product") || tp("notSpecified");
  const keyMessage = briefingText(campaign, "key_message") || tp("notSpecified");
  const mustHave = briefingText(campaign, "must_have") || tp("noSpecs");
  const donts = briefingText(campaign, "donts") || tp("noSpecs");
  const cta = briefingText(campaign, "cta") || tp("noCta");
  const hashtags = briefingText(campaign, "hashtags") || tp("noHashtags");
  const coupon = briefingText(campaign, "coupon") || tp("noneItem");
  const supportLink = briefingText(campaign, "link");

  async function submitMaterial() {
    if (isApproved) {
      if (!publishedUrl.trim()) {
        await alertWarning(tp("materialRequiredTitle"), tp("publishedLinkRequired"));
        return;
      }
    } else if (canSubmitScript) {
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
      if (!videoFile && !row.content?.video_url && !publishedUrl.trim()) {
        await alertWarning(tp("materialRequiredTitle"), tp("videoRequired"));
        return;
      }
    } else if (!script.trim() && !videoFile && !publishedUrl.trim()) {
      await alertWarning(tp("materialRequiredTitle"), tp("materialRequired"));
      return;
    }
    setSubmitting(true);
    try {
      let videoUrl = row.content?.video_url || null;
      let videoFileSize = row.content?.video_file_size ?? 0;
      if (videoFile && canSubmitVideo) {
        const uploaded = await api.uploadMedia(videoFile, videoFile.name);
        videoUrl = uploaded.data.url;
        videoFileSize = uploaded.data.size ?? videoFile.size;
      }

      const body: Record<string, unknown> = {};
      if (isApproved) {
        body.published_link = publishedUrl.trim();
        body.delivery_status = "published";
      } else if (canSubmitScript) {
        body.script = script.trim();
        body.script_status = "submitted";
        body.delivery_status = "sent";
      } else if (canSubmitVideo) {
        if (videoUrl) {
          body.video_url = videoUrl;
          body.video_file_size = videoFileSize;
          body.video_status = "submitted";
          body.delivery_status = "sent";
        }
        if (publishedUrl.trim()) {
          body.published_link = publishedUrl.trim();
          body.delivery_status = "published";
        }
      } else {
        if (script.trim()) {
          body.script = script.trim();
          body.script_status = "submitted";
        }
        if (videoUrl) {
          body.video_url = videoUrl;
          body.video_file_size = videoFileSize;
          body.video_status = "submitted";
        }
        if (publishedUrl.trim()) {
          body.published_link = publishedUrl.trim();
          body.delivery_status = "published";
        } else if (script.trim() || videoUrl) {
          body.delivery_status = "sent";
        }
      }

      await api.updateParticipation(row.id, body);
      await alertSuccess(
        isApproved
          ? tp("publishedLinkSent")
          : hasRevision
            ? tp("newVersionSent")
            : canSubmitScript && stagedFlow
              ? tp("scriptSentWaiting")
              : tp("materialSent"),
      );
      setVideoFile(null);
      onSubmitted();
      onClose();
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
    ? (requiresNewVideoFile
      ? Boolean(videoFile)
      : Boolean(videoFile || row.content?.video_url || publishedUrl.trim()))
    : false;
  const submitDisabled = submitting
    || awaitingScriptApproval
    || awaitingVideoApproval
    || (isApproved
      ? !publishedUrl.trim()
      : canSubmitScript
        ? !scriptReady
        : canSubmitVideo
          ? !videoReady
          : !script.trim() && !videoFile && !publishedUrl.trim());

  return (
    <div className="flex flex-col gap-5 border-l-4 border-l-brand-primary bg-indigo-50/20 p-5 sm:p-6">
      {briefingOpen ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h5 className="flex items-center gap-2 text-xs font-black tracking-wider text-slate-900 uppercase">
              <FileText size={16} className="text-brand-primary" />
              {tp("creativeBriefing", { name: campaign.name })}
            </h5>
            <button
              type="button"
              onClick={() => setBriefingOpen(false)}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
            >
              <ChevronUp size={13} /> {tp("closePanel")}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 text-xs font-medium md:grid-cols-2">
            <div>
              <span className="mb-1 block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("briefingProduct")}</span>
              <p className="font-medium text-slate-800">{product}</p>
            </div>
            <div>
              <span className="mb-1 block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("briefingKeyMessage")}</span>
              <p className="font-medium text-slate-800">{keyMessage}</p>
            </div>
            <div className="md:col-span-2">
              <span className="mb-1 block text-[9px] font-bold tracking-wide text-emerald-600 uppercase">{tp("briefingMustHave")}</span>
              <p className="rounded-xl border border-emerald-100/60 bg-emerald-50/40 p-3.5 leading-relaxed whitespace-pre-line text-slate-800">{mustHave}</p>
            </div>
            <div className="md:col-span-2">
              <span className="mb-1 block text-[9px] font-bold tracking-wide text-rose-500 uppercase">{tp("briefingDonts")}</span>
              <p className="rounded-xl border border-rose-100/60 bg-rose-50/40 p-3.5 leading-relaxed whitespace-pre-line text-slate-800">{donts}</p>
            </div>
            <div>
              <span className="mb-1 block text-[9px] font-bold tracking-wide text-brand-primary uppercase">{tp("briefingCta")}</span>
              <p className="font-medium text-slate-800">{cta}</p>
            </div>
            <div>
              <span className="mb-1 block text-[9px] font-bold tracking-wide text-indigo-600 uppercase">{tp("briefingHashtags")}</span>
              <p className="font-mono text-slate-800">{hashtags}</p>
            </div>
            <div>
              <span className="mb-1 block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("briefingCoupon")}</span>
              <p className="inline-block rounded border border-emerald-100 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">{coupon}</p>
            </div>
            <div>
              <span className="mb-1 block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("briefingLink")}</span>
              {supportLink ? (
                <a href={supportLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-brand-primary hover:underline">
                  {tp("openSupportLink")} <ExternalLink size={11} />
                </a>
              ) : (
                <p className="text-slate-500">{tp("noneItem")}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
        <h5 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-black tracking-wider text-slate-900 uppercase">
          {isApproved ? <Link2 size={15} className="text-emerald-600" /> : <Send size={15} className="text-brand-primary" />}
          {isApproved ? tp("publishLinkTitle") : tp("submissionTitle")}
        </h5>

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
            {(row.script_feedback && scriptRevision) || (row.video_feedback && videoRevision) || (row.revision_details && deliveryRevision) ? (
              <div className="rounded-xl border border-rose-200 bg-white/90 px-3 py-2.5">
                <span className="mb-1 block text-[9px] font-extrabold tracking-wider text-rose-600 uppercase">{tp("revisionFeedbackLabel")}</span>
                <p className="m-0 text-xs leading-relaxed font-semibold whitespace-pre-wrap text-slate-800">
                  {scriptRevision ? row.script_feedback : videoRevision ? row.video_feedback : row.revision_details}
                </p>
              </div>
            ) : null}
            <p className="m-0 flex items-center gap-1.5 text-[11px] font-bold text-rose-900">
              <RefreshCw size={12} /> {tp("revisionSendNewVersionHint")}
            </p>
            {requiresNewVideoFile ? (
              <p className="m-0 text-[11px] font-semibold text-rose-800">
                {tp("newVideoFileRequiredHint", { n: nextVideoVersion })}
              </p>
            ) : null}
          </div>
        ) : null}

        {awaitingScriptApproval ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
            {tp("waitingScriptApproval")}
          </div>
        ) : null}

        {awaitingVideoApproval ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
            {tp("waitingVideoApproval")}
          </div>
        ) : null}

        {stagedFlow && scriptApproved && !videoApproved && !videoRevision && !awaitingVideoApproval && !isApproved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900">
            {tp("scriptApprovedSendVideo")}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {!isApproved ? (
            <>
          {showScriptField ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{tp("scriptLabel")}</label>
            <textarea
              rows={4}
              placeholder={tp("scriptPh")}
              value={script}
              onChange={(event) => setScript(event.target.value)}
              disabled={scriptApproved || scriptSubmitted || awaitingScriptApproval}
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-medium transition-all outline-none focus:border-brand-primary focus:bg-white disabled:opacity-60"
            />
          </div>
          ) : null}

          {canSubmitVideo ? (
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{tp("videoLabel")}</label>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/*,.mp4,.mov,.webm"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("video/")) {
                      void alertWarning(tp("invalidVideoTitle"), tp("invalidVideo"));
                      event.target.value = "";
                      return;
                    }
                    if (file.size > 150 * 1024 * 1024) {
                      void alertWarning(tp("invalidVideoTitle"), tp("videoTooBig"));
                      event.target.value = "";
                      return;
                    }
                    setVideoFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border-none bg-slate-100 px-3.5 text-[11px] font-bold tracking-wider text-slate-800 uppercase transition-colors hover:bg-slate-200"
                >
                  <UploadCloud size={14} /> {tp("chooseFile")}
                </button>
                {videoFile ? (
                  <span className="flex items-center truncate rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                    {videoFile.name}
                    {hasRevision ? ` · ${tp("versionBadge", { n: nextVideoVersion })}` : ""}
                  </span>
                ) : requiresNewVideoFile && row.content?.video_url ? (
                  <span className="flex items-center truncate rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {tp("previousVideoAttachedSelectNew")}
                  </span>
                ) : null}
              </div>
            </div>

            {row.content?.video_url ? (
              <CampaignSubmittedVideo
                videoUrl={row.content.video_url}
                fileSize={row.content.video_file_size}
                compact
              />
            ) : null}
          </div>
          ) : awaitingVideoApproval && row.content?.video_url ? (
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{tp("videoLabel")}</label>
              <span className="text-xs font-semibold text-emerald-700">{tp("videoSentWaiting")}</span>
            </div>
            <CampaignSubmittedVideo
              videoUrl={row.content.video_url}
              fileSize={row.content.video_file_size}
              compact
            />
          </div>
          ) : null}
            </>
          ) : null}

          {isApproved ? (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="m-0 text-[11px] font-medium text-emerald-800">{tp("approvedPublishHint")}</p>
              {row.content?.video_url ? (
                <CampaignSubmittedVideo
                  videoUrl={row.content.video_url}
                  fileSize={row.content.video_file_size}
                  compact
                />
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{tp("publishedLinkLabel")}</label>
                <input
                  type="url"
                  placeholder={tp("publishedLinkPh")}
                  value={publishedUrl}
                  onChange={(event) => setPublishedUrl(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs outline-none focus:border-brand-primary"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {tp("collapseBriefing")}
            </button>
            <button
              type="button"
              disabled={submitDisabled}
              onClick={() => void submitMaterial()}
              className={cn(
                "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-none px-5 text-xs font-bold tracking-wider uppercase shadow-md transition-all disabled:cursor-not-allowed disabled:shadow-none",
                submitDisabled
                  ? "bg-slate-100 text-slate-400"
                  : isApproved
                    ? "bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700"
                    : hasRevision
                      ? "bg-rose-600 text-white shadow-rose-600/20 hover:bg-rose-700"
                      : "bg-brand-primary text-white shadow-indigo-600/20 hover:bg-indigo-600",
              )}
            >
              {isApproved ? <Link2 size={15} /> : hasRevision ? <RefreshCw size={15} /> : <CheckCircle2 size={15} />}
              {isApproved
                ? tp("sendPublishedLink")
                : hasRevision
                  ? tp("sendNewVersionNumbered", {
                      n: canSubmitVideo ? nextVideoVersion : nextScriptVersion,
                    })
                  : canSubmitScript && stagedFlow
                    ? tp("sendScriptForReview")
                    : tp("sendForReview")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
