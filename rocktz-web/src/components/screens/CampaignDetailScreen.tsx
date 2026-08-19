"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select2Field } from "@/components/Select2Field";
import { api, money } from "@/lib/api";
import { alertApiError, alertSuccess } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { Campaign, CampaignCreator, Creator } from "@/lib/types";

function DetailInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const id = usePathname().split("/").filter(Boolean).pop() ?? "";
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tab, setTab] = useState<"entregas" | "candidaturas" | "briefing">("entregas");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [assignId, setAssignId] = useState("");
  const [script, setScript] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [published, setPublished] = useState("");
  const [selected, setSelected] = useState<CampaignCreator | null>(null);

  async function load() {
    if (!id || id === "_") return;
    try {
      const res = await api.campaign(id);
      setCampaign(res.data);
      const first = res.data.applications?.[0] ?? null;
      setSelected(first);
      setScript(first?.content?.script ?? "");
      setVideoUrl(first?.content?.video_url ?? "");
      setPublished(first?.content?.published_link ?? "");
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
    if (user.role === "admin") {
      api.creators("?status=active").then((res) => setCreators(res.data)).catch(() => undefined);
    }
  }, [id, user.role]);

  if (!campaign) return <p className="text-sm text-slate-500">{tc("loadingCampaign")}</p>;

  const applications = campaign.applications ?? [];

  async function patch(participation: CampaignCreator, body: Record<string, unknown>) {
    try {
      await api.updateParticipation(participation.id, body);
      await load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={campaign.company?.name}
        actions={<StatusBadge status={campaign.status} />}
      />
      <p className="mb-6 text-sm text-slate-600">{campaign.objective} · {money(campaign.total_budget)}</p>
      <div className="mb-5 flex gap-2">
        {(["entregas", "candidaturas", "briefing"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize ${tab === item ? "bg-purple-600 text-white" : "bg-slate-100"}`}>{t(`campaignDetail.${item}`)}</button>
        ))}
      </div>

      {tab === "briefing" ? (
        <div className="rounded-2xl border bg-white p-5 text-sm">
          <p><b>{t("campaignDetail.product")}</b> {String(campaign.briefing?.product ?? "—")}</p>
          <p className="mt-2"><b>{t("campaignDetail.message")}</b> {String(campaign.briefing?.key_message ?? "—")}</p>
          <p className="mt-2"><b>{t("campaignDetail.cta")}</b> {String(campaign.briefing?.cta ?? "—")}</p>
          <p className="mt-2"><b>{t("campaignDetail.hashtags")}</b> {String(campaign.briefing?.hashtags ?? "—")}</p>
        </div>
      ) : null}

      {tab === "candidaturas" ? (
        <div className="space-y-3">
          {user.role === "admin" ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Select2Field theme="light" placeholder={t("campaignDetail.assign")} value={assignId} options={creators.map((c) => ({ value: String(c.id), label: `@${c.artistic_name}` }))} onChange={setAssignId} />
              </div>
              <button type="button" className="rounded-xl bg-purple-600 px-4 text-sm font-bold text-white" onClick={async () => {
                if (!assignId) return;
                await api.assignCreator(campaign.id, { creator_id: Number(assignId) }).catch(alertApiError);
                setAssignId("");
                load();
              }}>{t("campaignDetail.allocate")}</button>
            </div>
          ) : null}
          {applications.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-2xl border bg-white p-4">
              <div>
                <p className="font-bold">@{row.creator?.artistic_name}</p>
                <StatusBadge status={row.application_status} />
              </div>
              {user.role === "admin" && row.application_status === "pending" ? (
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => patch(row, { application_status: "approved" })}>{t("campaignDetail.approve")}</button>
                  <button type="button" className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => patch(row, { application_status: "rejected" })}>{t("campaignDetail.reject")}</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tab === "entregas" ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {applications.filter((row) => row.application_status === "approved").map((row) => (
              <button key={row.id} type="button" onClick={() => { setSelected(row); setScript(row.content?.script ?? ""); setVideoUrl(row.content?.video_url ?? ""); setPublished(row.content?.published_link ?? ""); }} className={`w-full rounded-xl border p-3 text-left ${selected?.id === row.id ? "border-purple-500" : "border-slate-200"}`}>
                <p className="font-bold">@{row.creator?.artistic_name}</p>
                <StatusBadge status={row.delivery_status} />
              </button>
            ))}
          </div>
          {selected ? (
            <div className="space-y-3 rounded-2xl border bg-white p-5">
              <h3 className="font-black">{t("campaignDetail.material", { name: selected.creator?.artistic_name })}</h3>
              <textarea className="min-h-24 w-full rounded-xl border p-3 text-sm" placeholder={t("campaignDetail.script")} value={script} onChange={(e) => setScript(e.target.value)} />
              <input className="h-11 w-full rounded-xl border px-4" placeholder={t("campaignDetail.videoUrl")} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
              <input className="h-11 w-full rounded-xl border px-4" placeholder={t("campaignDetail.publishedLink")} value={published} onChange={(e) => setPublished(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white" onClick={async () => {
                  await patch(selected, { script, video_url: videoUrl, published_link: published, script_status: "submitted", video_status: videoUrl ? "submitted" : selected.video_status });
                  await alertSuccess(t("campaignDetail.sent"));
                }}>{t("campaignDetail.saveUrls")}</button>
                {user.role !== "creator" ? (
                  <>
                    <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white" onClick={() => patch(selected, { script_status: "approved", video_status: "approved", delivery_status: "approved" })}>{t("campaignDetail.approve")}</button>
                    <button type="button" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white" onClick={() => patch(selected, { delivery_status: "revision", script_status: "revision" })}>{t("campaignDetail.revision")}</button>
                    <button type="button" className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white" onClick={() => patch(selected, { delivery_status: "published" })}>{t("campaignDetail.markPublished")}</button>
                  </>
                ) : null}
              </div>
            </div>
          ) : <p className="text-sm text-slate-400">{t("campaignDetail.noneAllocated")}</p>}
        </div>
      ) : null}
      <p className="mt-6"><Link href="/campaigns" className="text-sm font-bold text-purple-700">{t("campaignDetail.back")}</Link></p>
    </>
  );
}

export function CampaignDetailScreen() {
  return <AuthenticatedShell><DetailInner /></AuthenticatedShell>;
}
