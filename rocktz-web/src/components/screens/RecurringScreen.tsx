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
import type { Company, RecurringContract } from "@/lib/types";

function RecurringInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [items, setItems] = useState<RecurringContract[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", company_id: "", monthly_fee: "", objective: "" });

  async function load() {
    try {
      setItems((await api.recurring()).data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
    if (user.role !== "creator") api.companies().then((res) => setCompanies(res.data)).catch(() => undefined);
  }, [user.role]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.title) {
      await alertWarning(t("recurring.titleRequired"), t("recurring.titleRequiredText"));
      return;
    }
    if (user.role === "admin" && !form.company_id) {
      await alertWarning(t("recurring.companyRequired"), t("recurring.companyRequiredText"));
      return;
    }
    try {
      await api.createRecurring({
        title: form.title,
        company_id: user.role === "admin" ? Number(form.company_id) : user.company?.id,
        monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null,
        objective: form.objective,
      });
      setOpen(false);
      await alertSuccess(t("recurring.created"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <>
      <PageHeader
        title={t("recurring.title")}
        subtitle={t("recurring.subtitle")}
        actions={user.role !== "creator" ? <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white">{t("recurring.new")}</button> : null}
      />
      <div className="space-y-3">
        {items.map((row) => (
          <Link key={row.id} href={`/recurring/${row.id}`} className="block rounded-2xl border bg-white p-5 hover:border-purple-400">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-black">{row.title}</h3>
                <p className="text-sm text-slate-500">{row.company?.name} · {money(row.monthly_fee)}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
          </Link>
        ))}
        {!items.length ? <p className="text-sm text-slate-400">{t("recurring.empty")}</p> : null}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form noValidate onSubmit={onCreate} className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-6">
            <h2 className="text-xl font-black">{t("recurring.modalTitle")}</h2>
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("recurring.contractTitle")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            {user.role === "admin" ? (
              <Select2Field theme="light" placeholder={t("campaigns.company")} value={form.company_id} options={companies.map((c) => ({ value: String(c.id), label: c.name }))} onChange={(value) => setForm({ ...form, company_id: value })} />
            ) : null}
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("recurring.fee")} value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("recurring.objective")} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
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

export function RecurringScreen() {
  return <AuthenticatedShell><RecurringInner /></AuthenticatedShell>;
}
