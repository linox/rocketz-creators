"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { Company } from "@/lib/types";

function CompaniesInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [items, setItems] = useState<Company[]>([]);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", responsible_name: "", email: "", whatsapp: "", segment: "", city: "" });

  const statusOptions = [
    { value: "", label: t("companies.all") },
    { value: "pending", label: t("companies.pending") },
    { value: "active", label: t("companies.active") },
    { value: "rejected", label: t("companies.rejected") },
  ];

  async function load() {
    try {
      const res = await api.companies(status ? `?status=${status}` : "");
      setItems(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.name || !form.responsible_name || !form.email) {
      await alertWarning(tc("alerts.incompleteTitle"), t("companies.incomplete"));
      return;
    }
    try {
      await api.createCompany(form);
      setOpen(false);
      await alertSuccess(t("companies.created"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <>
      <PageHeader
        title={t("companies.title")}
        subtitle={t("companies.subtitle", { count: items.length })}
        actions={user.role === "admin" ? <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white">{t("companies.new")}</button> : null}
      />
      <div className="mb-5 w-52">
        <Select2Field theme="light" placeholder={t("companies.status")} value={status} options={statusOptions} onChange={setStatus} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((company) => (
          <article key={company.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="font-black">{company.name}</h3>
                <p className="text-sm text-slate-500">{company.segment} · {company.city}</p>
              </div>
              <StatusBadge status={company.status} />
            </div>
            <p className="text-sm text-slate-600">{company.responsible_name} · {company.email}</p>
            {user.role === "admin" && company.status === "pending" ? (
              <div className="mt-4 flex gap-2">
                <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white" onClick={async () => {
                  if (await alertConfirm(t("companies.approveTitle"), company.name)) {
                    await api.approveCompany(company.id).catch(alertApiError);
                    load();
                  }
                }}>{t("companies.approve")}</button>
                <button type="button" className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white" onClick={async () => {
                  if (await alertConfirm(t("companies.rejectTitle"), company.name, t("companies.reject"))) {
                    await api.rejectCompany(company.id).catch(alertApiError);
                    load();
                  }
                }}>{t("companies.reject")}</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form noValidate onSubmit={onCreate} className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-6">
            <h2 className="text-xl font-black">{t("companies.modalTitle")}</h2>
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("companies.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("companies.responsible")} value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("companies.email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("companies.whatsapp")} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("companies.segment")} value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("companies.city")} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border py-3 font-bold">{tc("cancel")}</button>
              <button className="flex-1 rounded-xl bg-purple-600 py-3 font-bold text-white">{tc("save")}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function CompaniesScreen() {
  return <AuthenticatedShell><CompaniesInner /></AuthenticatedShell>;
}
