"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select2Field } from "@/components/Select2Field";
import { api, money } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { Campaign, Company } from "@/lib/types";

function CampaignsInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [items, setItems] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company_id: "", objective: "", total_budget: "", image_url: "" });

  const statusOptions = [
    { value: "", label: tc("all") },
    { value: "briefing", label: t("status.briefing") },
    { value: "selection", label: t("status.selection") },
    { value: "production", label: t("status.production") },
    { value: "published", label: t("status.published") },
    { value: "finished", label: t("status.finished") },
  ];

  async function load() {
    try {
      const res = await api.campaigns(status ? `?status=${status}` : "");
      setItems(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
    if (user.role === "admin") {
      api.companies().then((res) => setCompanies(res.data)).catch(() => undefined);
    }
  }, [status, user.role]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "true") setOpen(true);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.name || (user.role === "admin" && !form.company_id)) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaigns.incomplete"));
      return;
    }
    try {
      await api.createCampaign({
        name: form.name,
        company_id: user.role === "admin" ? Number(form.company_id) : user.company?.id,
        objective: form.objective,
        total_budget: form.total_budget ? Number(form.total_budget) : null,
        image_url: form.image_url || null,
        status: "selection",
      });
      setOpen(false);
      await alertSuccess(t("campaigns.created"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <>
      <PageHeader
        title={t("campaigns.title")}
        subtitle={t("campaigns.subtitle")}
        actions={user.role !== "creator" ? <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white">{t("campaigns.new")}</button> : null}
      />
      <div className="mb-5 w-52">
        <Select2Field theme="light" placeholder={tc("status")} value={status} options={statusOptions} onChange={setStatus} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((campaign) => (
          <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-purple-400">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="font-black">{campaign.name}</h3>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-sm text-slate-500">{campaign.company?.name}</p>
            <p className="mt-2 text-sm font-semibold">{money(campaign.total_budget)}</p>
            {campaign.pending_applications ? <p className="mt-1 text-xs font-bold text-amber-700">{t("campaigns.applications", { count: campaign.pending_applications })}</p> : null}
          </Link>
        ))}
        {!items.length ? <p className="text-sm text-slate-400">{t("campaigns.none")}</p> : null}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form noValidate onSubmit={onCreate} className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-6">
            <h2 className="text-xl font-black">{t("campaigns.modalTitle")}</h2>
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("campaigns.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {user.role === "admin" ? (
              <Select2Field theme="light" placeholder={t("campaigns.company")} value={form.company_id} options={companies.map((c) => ({ value: String(c.id), label: c.name }))} onChange={(value) => setForm({ ...form, company_id: value })} />
            ) : null}
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("campaigns.objective")} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("campaigns.budget")} value={form.total_budget} onChange={(e) => setForm({ ...form, total_budget: e.target.value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("campaigns.image")} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border py-3 font-bold">{tc("cancel")}</button>
              <button className="flex-1 rounded-xl bg-purple-600 py-3 font-bold text-white">{tc("create")}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function CampaignsScreen() {
  return <AuthenticatedShell><CampaignsInner /></AuthenticatedShell>;
}
