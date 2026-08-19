"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select2Field } from "@/components/Select2Field";
import { api, money } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { Creator, PlanningItem, RecurringContract } from "@/lib/types";

function DetailInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const id = usePathname().split("/").filter(Boolean).pop() ?? "";
  const [contract, setContract] = useState<RecurringContract | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [tab, setTab] = useState<"creators" | "pautas">("pautas");
  const [form, setForm] = useState({ creator_id: "", title: "", month: new Date().toISOString().slice(0, 7), content_type: "reel", briefing: "", submission_url: "" });

  const formatOptions = [
    { value: "reel", label: t("recurringDetail.formats.reel") },
    { value: "story", label: t("recurringDetail.formats.story") },
    { value: "ugc", label: t("recurringDetail.formats.ugc") },
    { value: "tiktok", label: t("recurringDetail.formats.tiktok") },
    { value: "post", label: t("recurringDetail.formats.post") },
  ];

  async function load() {
    if (!id || id === "_") return;
    try {
      setContract((await api.recurringOne(id)).data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
    if (user.role !== "creator") api.creators("?status=active").then((res) => setCreators(res.data)).catch(() => undefined);
  }, [id, user.role]);

  if (!contract) return <p className="text-sm text-slate-500">{tc("loadingContract")}</p>;

  const current = contract;
  const items = current.items ?? [];
  const creatorOptions = (contract.creators ?? []).map((row) => ({
    value: String(row.creator_id),
    label: `@${row.creator?.artistic_name ?? row.creator_id}`,
  }));

  async function addItem(event: FormEvent) {
    event.preventDefault();
    if (!form.creator_id || !form.title) {
      await alertWarning(tc("alerts.incompleteTitle"), t("recurringDetail.incomplete"));
      return;
    }
    try {
      await api.addPlanningItem(current.id, {
        creator_id: Number(form.creator_id),
        title: form.title,
        month: form.month,
        content_type: form.content_type,
        briefing: form.briefing || null,
      });
      await alertSuccess(t("recurringDetail.created"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <>
      <PageHeader title={contract.title} subtitle={`${contract.company?.name} · ${money(contract.monthly_fee)}`} actions={<StatusBadge status={contract.status} />} />
      <div className="mb-5 flex gap-2">
        <button type="button" onClick={() => setTab("pautas")} className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === "pautas" ? "bg-purple-600 text-white" : "bg-slate-100"}`}>{t("recurringDetail.items")}</button>
        <button type="button" onClick={() => setTab("creators")} className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === "creators" ? "bg-purple-600 text-white" : "bg-slate-100"}`}>{t("recurringDetail.creators")}</button>
      </div>
      {tab === "creators" ? (
        <div className="space-y-3">
          {(contract.creators ?? []).map((row) => (
            <div key={row.id} className="rounded-2xl border bg-white p-4">
              <p className="font-black">@{row.creator?.artistic_name}</p>
              <p className="text-sm text-slate-500">{money(row.monthly_fee)}</p>
            </div>
          ))}
          {user.role !== "creator" ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Select2Field theme="light" placeholder={t("recurringDetail.addCreator")} value={form.creator_id} options={creators.map((c) => ({ value: String(c.id), label: `@${c.artistic_name}` }))} onChange={(value) => setForm({ ...form, creator_id: value })} />
              </div>
              <button type="button" className="rounded-xl bg-purple-600 px-4 font-bold text-white" onClick={async () => {
                if (!form.creator_id) return;
                await api.addRecurringCreator(current.id, { creator_id: Number(form.creator_id) }).catch(alertApiError);
                load();
              }}>{t("recurringDetail.allocate")}</button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {user.role !== "creator" ? (
            <form noValidate onSubmit={addItem} className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
              <Select2Field theme="light" placeholder={t("recurringDetail.creator")} value={form.creator_id} options={creatorOptions.length ? creatorOptions : creators.map((c) => ({ value: String(c.id), label: `@${c.artistic_name}` }))} onChange={(value) => setForm({ ...form, creator_id: value })} />
              <input className="h-11 rounded-xl border px-4" placeholder={t("recurringDetail.title")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <input className="h-11 rounded-xl border px-4" type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
              <Select2Field theme="light" placeholder={t("recurringDetail.format")} value={form.content_type} options={formatOptions} onChange={(value) => setForm({ ...form, content_type: value })} />
              <input className="h-11 rounded-xl border px-4 md:col-span-2" placeholder={t("recurringDetail.briefing")} value={form.briefing} onChange={(e) => setForm({ ...form, briefing: e.target.value })} />
              <button className="rounded-xl bg-purple-600 py-3 font-bold text-white md:col-span-2">{t("recurringDetail.addItem")}</button>
            </form>
          ) : null}
          {Object.entries(
            items.reduce<Record<string, PlanningItem[]>>((acc, item) => {
              (acc[item.month] ??= []).push(item);
              return acc;
            }, {}),
          ).map(([month, monthItems]) => (
            <section key={month} className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">{month}</h3>
              {monthItems.map((item) => (
                <PlanningCard key={item.id} item={item} canReview={user.role !== "creator"} onSaved={load} />
              ))}
            </section>
          ))}
          {!items.length ? <p className="text-sm text-slate-400">{t("recurringDetail.empty")}</p> : null}
        </div>
      )}
      <p className="mt-6"><Link href="/recurring" className="text-sm font-bold text-purple-700">{t("recurringDetail.back")}</Link></p>
    </>
  );
}

function PlanningCard({ item, canReview, onSaved }: { item: PlanningItem; canReview: boolean; onSaved: () => void }) {
  const { t } = useTranslation("app");
  const [url, setUrl] = useState(item.submission_url ?? item.media_url ?? "");

  return (
    <article className="rounded-2xl border bg-white p-4">
      <div className="mb-2 flex justify-between gap-2">
        <div>
          <h3 className="font-black">{item.title}</h3>
          <p className="text-xs text-slate-500">@{item.creator?.artistic_name} · {item.month} · {item.content_type}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <p className="text-sm text-slate-600">{item.briefing || item.description}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input className="h-11 flex-1 rounded-xl border px-4" placeholder={t("recurringDetail.materialUrl")} value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="rounded-xl bg-slate-900 px-4 text-sm font-bold text-white" onClick={async () => {
          try {
            await api.updatePlanningItem(item.id, { submission_url: url, media_url: url, status: "review" });
            await alertSuccess(t("recurringDetail.sentReview"));
            onSaved();
          } catch (err) {
            await alertApiError(err);
          }
        }}>{t("recurringDetail.submit")}</button>
        {canReview ? (
          <>
            <button type="button" className="rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white" onClick={async () => {
              try {
                await api.updatePlanningItem(item.id, { status: "approved" });
                onSaved();
              } catch (err) {
                await alertApiError(err);
              }
            }}>{t("recurringDetail.approve")}</button>
            <button type="button" className="rounded-xl bg-purple-600 px-4 text-sm font-bold text-white" onClick={async () => {
              try {
                await api.updatePlanningItem(item.id, { status: "published", published_url: url });
                onSaved();
              } catch (err) {
                await alertApiError(err);
              }
            }}>{t("recurringDetail.publish")}</button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export function RecurringDetailScreen() {
  return <AuthenticatedShell><DetailInner /></AuthenticatedShell>;
}
