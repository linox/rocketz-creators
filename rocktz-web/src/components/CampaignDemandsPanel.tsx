"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Link2, ScrollText, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CampaignSubmittedVideo } from "@/components/CampaignSubmittedVideo";
import { ScriptDocumentLink } from "@/components/ScriptDocumentLink";
import { alertConfirm, alertSuccess, alertWarning, promptTextarea } from "@/lib/alerts";
import { projectDemand } from "@/lib/campaign-demands";
import { campaignCreatorDeliveryState } from "@/lib/content-delivery-status";
import { cn } from "@/lib/cn";
import { safeHttpUrl } from "@/lib/safe-http-url";
import type { CampaignCreator, CampaignDemand } from "@/lib/types";

type Props = {
  row: CampaignCreator;
  flow?: string | null;
  canManage: boolean;
  updating: boolean;
  onUpdate: (demandId: number, body: Record<string, unknown>) => Promise<unknown>;
  onSavePauta: (demandId: number, text: string | null) => Promise<void>;
  onPautaChange?: (demandId: number, text: string) => void;
};

function statusLabel(state: string, t: (key: string) => string) {
  if (state === "published") return t("campaignDetail.published");
  if (state === "approved") return t("campaignDetail.approved");
  if (state === "scriptRevision") return t("campaignDetail.scriptRevisionStatus");
  if (state === "videoRevision") return t("campaignDetail.videoRevisionStatus");
  if (state === "revision") return t("campaignDetail.adjustments");
  if (state === "scriptReview") return t("campaignDetail.scriptReviewStatus");
  if (state === "videoReview") return t("campaignDetail.videoReviewStatus");
  if (state === "scriptApproved") return t("campaignDetail.scriptApprovedStatus");
  if (state === "sent") return t("campaignDetail.inReview");
  return t("campaignDetail.waiting");
}

export function CampaignDemandsPanel({ row, flow, canManage, updating, onUpdate, onSavePauta, onPautaChange }: Props) {
  const { t } = useTranslation("app");
  const demands = row.demands ?? [];
  if (!demands.length) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div>
        <h3 className="m-0 text-sm font-black text-slate-900">{t("campaignDetail.demandsTitle")}</h3>
        <p className="m-0 mt-1 text-[11px] leading-relaxed text-slate-500">{t("campaignDetail.demandsHint")}</p>
      </div>
      <div className="flex flex-col gap-3">
        {demands.map((demand) => (
          <DemandCard
            key={demand.id}
            row={row}
            demand={demand}
            flow={flow}
            canManage={canManage}
            updating={updating}
            onUpdate={onUpdate}
            onSavePauta={onSavePauta}
            onPautaChange={onPautaChange}
          />
        ))}
      </div>
    </section>
  );
}

function DemandCard({
  row,
  demand,
  flow,
  canManage,
  updating,
  onUpdate,
  onSavePauta,
  onPautaChange,
}: {
  row: CampaignCreator;
  demand: CampaignDemand;
  flow?: string | null;
  canManage: boolean;
  updating: boolean;
  onUpdate: (demandId: number, body: Record<string, unknown>) => Promise<unknown>;
  onSavePauta: (demandId: number, text: string | null) => Promise<void>;
  onPautaChange?: (demandId: number, text: string) => void;
}) {
  const { t } = useTranslation("app");
  const [pauta, setPauta] = useState(demand.pauta || "");
  const [savingPauta, setSavingPauta] = useState(false);
  const [linkDraft, setLinkDraft] = useState(demand.content?.published_link || "");
  useEffect(() => {
    setLinkDraft(demand.content?.published_link || "");
  }, [demand.content?.published_link]);
  useEffect(() => {
    setPauta(demand.pauta || "");
  }, [demand.id, demand.pauta]);
  useEffect(() => {
    onPautaChange?.(demand.id, pauta);
  }, [demand.id, onPautaChange, pauta]);
  const projected = projectDemand(row, demand);
  const state = campaignCreatorDeliveryState(projected, flow);
  const format = t(`campaignDetail.${demand.content_type}`, { defaultValue: demand.content_type });
  const title = t("campaignDetail.demandTitle", { format, n: demand.position, total: demand.total });
  const script = demand.content?.script?.trim() || "";
  const videoUrl = demand.content?.video_url?.trim() || "";
  const publishedUrl = safeHttpUrl(demand.content?.published_link || "");
  const demandPublished = demand.delivery_status === "published";
  const hasVideoMaterial = Boolean(
    videoUrl
    || demand.content?.image_url?.trim()
    || publishedUrl
    || demand.video_submitted_at
  );
  const canReviseScript = demand.script_status === "submitted"
    || (Boolean(script || demand.content?.script_file_url) && demand.script_status !== "approved" && !hasVideoMaterial);
  const canReviseVideo = hasVideoMaterial && demand.video_status !== "approved";
  const needsScript = state === "scriptReview";
  const needsVideo = state === "videoReview" || state === "sent";

  async function savePauta(event: FormEvent) {
    event.preventDefault();
    setSavingPauta(true);
    try {
      await onSavePauta(demand.id, pauta.trim() || null);
    } finally {
      setSavingPauta(false);
    }
  }

  const linkUnchanged = linkDraft.trim() === (demand.content?.published_link || "").trim();

  async function concludeDemand(withLink: boolean) {
    const link = linkDraft.trim();
    if (withLink) {
      if (!link || !safeHttpUrl(link)) {
        await alertWarning(t("deliveries.inbox.publishedLinkRequiredTitle"), t("deliveries.inbox.publishedLinkInvalid"));
        return;
      }
      await onUpdate(demand.id, {
        published_link: link,
        delivery_status: "published",
        script_status: "approved",
        video_status: "approved",
        script_feedback: "",
        video_feedback: "",
        revision_details: "",
      });
      return;
    }
    await onUpdate(demand.id, {
      delivery_status: "published",
      script_status: "approved",
      video_status: "approved",
      script_feedback: "",
      video_feedback: "",
      revision_details: "",
    });
  }

  async function revertConclusion() {
    if (!(await alertConfirm(
      t("campaignDetail.revertConclusionTitle"),
      t("campaignDetail.revertConclusionText"),
      t("campaignDetail.revertConclusion"),
    ))) return;
    const saved = await onUpdate(demand.id, { revert_publication: true });
    if (saved) await alertSuccess(t("campaignDetail.revertConclusionOk"));
  }

  async function requestRevision() {
    const note = await promptTextarea({
      title: t("campaignDetail.requestRevision"),
      placeholder: t("campaignDetail.revisionRequired"),
      requiredMessage: t("campaignDetail.revisionRequired"),
    });
    if (!note?.trim() || (!canReviseScript && !canReviseVideo)) return;
    const scriptRevision = canReviseScript;
    await onUpdate(demand.id, scriptRevision
      ? { delivery_status: "revision", revision_details: note.trim(), script_status: "revision", script_feedback: note.trim() }
      : { delivery_status: "revision", revision_details: note.trim(), video_status: "revision", video_feedback: note.trim() });
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="m-0 text-xs font-black tracking-wide text-slate-900 uppercase">{title}</h4>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-extrabold text-slate-600 uppercase">
          {statusLabel(state, t)}
        </span>
      </div>

      {canManage ? (
        <form noValidate onSubmit={savePauta} className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex items-start gap-2">
            <ScrollText size={14} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <p className="m-0 text-[11px] font-black text-slate-900">{t("campaignDetail.demandPautaTitle")}</p>
              <p className="m-0 mt-0.5 text-[10px] leading-relaxed text-slate-500">{t("campaignDetail.demandPautaHint")}</p>
            </div>
          </div>
          <textarea
            rows={3}
            value={pauta}
            onChange={(event) => setPauta(event.target.value)}
            placeholder={t("campaignDetail.demandPautaPh")}
            className="w-full resize-y rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs leading-relaxed font-medium text-slate-800 outline-none focus:border-amber-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPauta}
              className="cursor-pointer rounded-xl bg-amber-700 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {savingPauta ? t("campaignDetail.demandPautaSaving") : t("campaignDetail.demandPautaSave")}
            </button>
          </div>
        </form>
      ) : demand.pauta?.trim() ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
          <p className="m-0 text-[10px] font-black tracking-wider text-amber-800 uppercase">{t("campaignDetail.demandPautaTitle")}</p>
          <p className="m-0 mt-1 whitespace-pre-wrap text-xs leading-relaxed font-medium text-slate-800">{demand.pauta}</p>
        </div>
      ) : (
        <p className="m-0 text-[11px] font-medium text-slate-400">{t("campaignDetail.demandPautaEmpty")}</p>
      )}

      {script || demand.content?.script_file_url ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="m-0 text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.viewScript")}</p>
          {script ? <p className="m-0 mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-800">{script}</p> : null}
          {demand.content?.script_file_url ? (
            <div className="mt-2">
              <ScriptDocumentLink url={demand.content.script_file_url} filename={demand.content.script_file_name || ""} />
            </div>
          ) : null}
        </div>
      ) : null}

      {videoUrl ? (
        <CampaignSubmittedVideo videoUrl={videoUrl} fileSize={demand.content?.video_file_size} compact />
      ) : null}

      {publishedUrl ? (
        <a href={publishedUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-primary hover:underline">
          {publishedUrl}
        </a>
      ) : null}

      {canManage && !demandPublished ? (
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <label className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-emerald-800 uppercase">
            <Link2 size={11} /> {t("campaignDetail.publishedLinkLabel")}
          </label>
          <p className="m-0 text-[11px] font-medium text-emerald-900">{t("campaignDetail.concludeDemandHint")}</p>
          <input
            type="url"
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            placeholder={t("campaignDetail.publishedLinkPh")}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-primary"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={updating || !linkDraft.trim()}
              onClick={() => void concludeDemand(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black tracking-wider text-white uppercase hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Link2 size={13} /> {t("campaignDetail.approveWithPublishedLink")}
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={() => void concludeDemand(false)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-[11px] font-black tracking-wider text-emerald-800 uppercase hover:bg-emerald-50 disabled:opacity-50"
            >
              <Check size={13} /> {t("campaignDetail.concludeWithoutLink")}
            </button>
          </div>
        </div>
      ) : null}

      {canManage && demandPublished ? (
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <label className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-emerald-800 uppercase">
            <Link2 size={11} /> {t("campaignDetail.publishedLinkLabel")}
          </label>
          <p className="m-0 text-[11px] font-medium text-emerald-900">{t("campaignDetail.publishedLinkEditHint")}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              type="url"
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              placeholder={t("campaignDetail.publishedLinkPh")}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-primary"
            />
            <button
              type="button"
              disabled={updating || !linkDraft.trim() || linkUnchanged}
              onClick={() => void concludeDemand(true)}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black tracking-wider text-white uppercase hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {t("campaignDetail.updatePublishedLink")}
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={() => void revertConclusion()}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-[11px] font-black tracking-wider text-amber-950 uppercase hover:bg-amber-50 disabled:opacity-50"
            >
              <Undo2 size={13} /> {t("campaignDetail.revertConclusion")}
            </button>
          </div>
        </div>
      ) : null}

      {(demand.script_feedback || demand.video_feedback || demand.revision_details) && (state === "scriptRevision" || state === "videoRevision" || state === "revision") ? (
        <p className="m-0 whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
          {demand.script_status === "revision" ? demand.script_feedback : demand.video_status === "revision" ? demand.video_feedback : demand.revision_details}
        </p>
      ) : null}

      {canManage && (needsScript || needsVideo || canReviseScript || canReviseVideo) ? (
        <div className="flex flex-wrap gap-2">
          {needsScript ? (
            <button
              type="button"
              disabled={updating}
              onClick={() => void onUpdate(demand.id, { script_status: "approved", script_feedback: "" })}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black tracking-wider text-white uppercase hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check size={13} /> {t("campaignDetail.approveScript")}
            </button>
          ) : null}
          {needsVideo ? (
            <button
              type="button"
              disabled={updating}
              onClick={() => void onUpdate(demand.id, { video_status: "approved", delivery_status: "approved", video_feedback: "" })}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black tracking-wider text-white uppercase hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check size={13} /> {t("campaignDetail.approveMaterial")}
            </button>
          ) : null}
          {canReviseScript || canReviseVideo ? (
            <button
              type="button"
              disabled={updating}
              onClick={() => void requestRevision()}
              className={cn("cursor-pointer rounded-xl border border-rose-200 bg-white px-3 py-2 text-[11px] font-black tracking-wider text-rose-700 uppercase hover:bg-rose-50 disabled:opacity-50")}
            >
              {t("campaignDetail.requestRevision")}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
