"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import type { AuthUser } from "@/lib/auth";

function AdminInner() {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [items, setItems] = useState<AuthUser[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function load() {
    try {
      setItems((await api.adminUsers()).data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.name || !form.email || !form.password) {
      await alertWarning(tc("alerts.incompleteTitle"), t("admin.incomplete"));
      return;
    }
    try {
      await api.createAdmin(form);
      setForm({ name: "", email: "", password: "" });
      await alertSuccess(t("admin.created"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <>
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")} />
      <form noValidate onSubmit={onCreate} className="mb-6 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4">
        <input className="h-11 rounded-xl border px-4" placeholder={t("admin.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="h-11 rounded-xl border px-4" placeholder={t("admin.email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="h-11 rounded-xl border px-4" placeholder={t("admin.password")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="rounded-xl bg-purple-600 font-bold text-white">{tc("add")}</button>
      </form>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-2xl border bg-white p-4">
            <div>
              <p className="font-black">{item.name}</p>
              <p className="text-sm text-slate-500">{item.email}</p>
            </div>
            <button type="button" className="text-xs font-bold text-rose-600" onClick={async () => {
              if (await alertConfirm(t("admin.removeTitle"), item.email, tc("remove"))) {
                await api.deleteAdmin(item.id).catch(alertApiError);
                load();
              }
            }}>{tc("remove")}</button>
          </div>
        ))}
      </div>
    </>
  );
}

export function AdminUsersScreen() {
  return <AuthenticatedShell><AdminInner /></AuthenticatedShell>;
}
