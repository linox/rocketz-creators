"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { userHasPermission } from "@/lib/auth";
import { useAuth } from "@/lib/use-auth";

type MailTemplate = {
  id: number;
  key: string;
  audience: string;
  category: string;
  enabled: boolean;
  reminder_offsets: number[] | null;
  required_variables: string[];
  variables: string[];
  current?: Record<string, { subject: string; greeting: string; body: string; cta_label: string }>;
};

const LOCALES = [
  { value: "pt_BR", label: "PT" },
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
];

type SendingStatus = { sending_enabled: boolean; env_enabled: boolean; stored_enabled: boolean };

function MailTemplatesInner() {
  const { t } = useTranslation("app");
  const { t: tn } = useTranslation("nav");
  const me = useAuth();
  const canManage = userHasPermission(me, "mail.manage");
  const [items, setItems] = useState<MailTemplate[]>([]);
  const [sending, setSending] = useState<SendingStatus>({ sending_enabled: true, env_enabled: true, stored_enabled: true });
  const [selectedId, setSelectedId] = useState("");
  const [locale, setLocale] = useState("pt_BR");
  const [preview, setPreview] = useState("");
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const [form, setForm] = useState({ subject: "", greeting: "", body: "", cta_label: "", enabled: true, reminder_offsets: "3,1,0,-1" });

  const selected = useMemo(() => items.find((item) => String(item.id) === selectedId), [items, selectedId]);

  async function load() {
    const res = await api.mailTemplates();
    setItems(res.data);
    if (res.sending) setSending(res.sending);
    if (!selectedId && res.data[0]) setSelectedId(String(res.data[0].id));
  }

  useEffect(() => {
    if (!canManage) return;
    load().catch(alertApiError);
  }, [canManage]);

  async function toggleSending(next: boolean) {
    if (!sending.env_enabled) {
      await alertWarning(t("mail.sendingMaster"), t("mail.sendingDisabledEnv"));
      return;
    }
    if (!next) {
      const ok = await alertConfirm(t("mail.sendingMaster"), t("mail.sendingTurnOffConfirm"));
      if (!ok) return;
    }
    try {
      const res = await api.updateMailSettings({ sending_enabled: next });
      setSending(res.data);
      await alertSuccess(t("mail.sendingMaster"), next ? t("mail.sendingSavedOn") : t("mail.sendingSavedOff"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    api.mailTemplate(Number(selectedId))
      .then((res) => {
        const current = res.data.current?.[locale];
        setItems((prev) => prev.map((item) => (item.id === res.data.id ? { ...item, ...res.data } : item)));
        if (current) {
          setForm({
            subject: current.subject,
            greeting: current.greeting,
            body: current.body,
            cta_label: current.cta_label,
            enabled: res.data.enabled,
            reminder_offsets: (res.data.reminder_offsets ?? []).join(","),
          });
        }
      })
      .catch(alertApiError);
  }, [selectedId, locale]);

  async function refreshPreview() {
    if (!selectedId) return;
    try {
      const res = await api.previewMailTemplate(Number(selectedId));
      setPreview(res.html);
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    const offsets = form.reminder_offsets.split(",").map((v) => Number(v.trim())).filter((n) => Number.isFinite(n));
    try {
      await api.updateMailTemplate(Number(selectedId), {
        locale,
        subject: form.subject,
        greeting: form.greeting,
        body: form.body,
        cta_label: form.cta_label,
        enabled: form.enabled,
        reminder_offsets: offsets,
      });
      await alertSuccess(t("mail.templatesTitle"), t("mail.saved"));
      await refreshPreview();
    } catch (err) {
      await alertApiError(err);
    }
  }

  if (!canManage) {
    return <p className="text-sm text-slate-500">{tn("users")}</p>;
  }

  return (
    <>
      <PageHeader
        title={t("mail.templatesTitle")}
        subtitle={t("mail.templatesSubtitle")}
        actions={<Link href="/mail/log" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">{tn("mailLog")}</Link>}
      />
      <div className={`mb-6 flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 ${sending.sending_enabled ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"}`}>
        <div>
          <p className="text-sm font-bold text-slate-800">{t("mail.sendingMaster")}</p>
          <p className="mt-1 text-sm text-slate-500">{sending.env_enabled ? t("mail.sendingHint") : t("mail.sendingDisabledEnv")}</p>
          {!sending.sending_enabled ? <p className="mt-2 text-sm font-semibold text-amber-800">{t("mail.sendingPausedBanner")}</p> : null}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-primary"
            checked={sending.stored_enabled && sending.env_enabled}
            disabled={!sending.env_enabled}
            onChange={(e) => void toggleSending(e.target.checked)}
          />
          {sending.sending_enabled ? t("mail.sendingOn") : t("mail.sendingOff")}
        </label>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <form noValidate onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <Select2Field theme="light" placeholder={t("mail.template")} value={selectedId} options={items.map((item) => ({ value: String(item.id), label: item.key }))} onChange={setSelectedId} />
          <Select2Field theme="light" placeholder={t("mail.locale")} value={locale} options={LOCALES} onChange={setLocale} />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="accent-brand-primary" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            {form.enabled ? t("mail.enabled") : t("mail.disabled")}
          </label>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("mail.subject")} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("mail.greeting")} value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} />
          <textarea className="min-h-40 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("mail.body")} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("mail.cta")} value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("mail.reminders")} value={form.reminder_offsets} onChange={(e) => setForm({ ...form, reminder_offsets: e.target.value })} />
          <p className="text-xs text-slate-500">{t("mail.variables")}: {(selected?.variables ?? []).join(", ")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white">{t("mail.save")}</button>
            <button type="button" onClick={() => selectedId && api.testMailTemplate(Number(selectedId)).then(() => alertSuccess(t("mail.templatesTitle"), t("mail.testSent"))).catch(alertApiError)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">{t("mail.test")}</button>
            <button type="button" onClick={() => selectedId && api.restoreMailTemplate(Number(selectedId), locale).then(async () => {
              await alertSuccess(t("mail.templatesTitle"), t("mail.restored"));
              const res = await api.mailTemplate(Number(selectedId));
              const current = res.data.current?.[locale];
              if (current) {
                setForm({
                  subject: current.subject,
                  greeting: current.greeting,
                  body: current.body,
                  cta_label: current.cta_label,
                  enabled: res.data.enabled,
                  reminder_offsets: (res.data.reminder_offsets ?? []).join(","),
                });
              }
              await refreshPreview();
            }).catch(alertApiError)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">{t("mail.restore")}</button>
            <button type="button" onClick={() => refreshPreview().catch(() => alertWarning(t("mail.templatesTitle"), t("mail.emptyTemplates")))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">{t("mail.previewDesktop")}</button>
          </div>
        </form>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => setWidth("desktop")} className="rounded-lg bg-white px-3 py-1 text-xs font-bold">{t("mail.previewDesktop")}</button>
            <button type="button" onClick={() => setWidth("mobile")} className="rounded-lg bg-white px-3 py-1 text-xs font-bold">{t("mail.previewMobile")}</button>
          </div>
          <iframe title="preview" className={width === "mobile" ? "h-[640px] w-[375px] rounded-xl border border-slate-200 bg-white" : "h-[640px] w-[640px] max-w-full rounded-xl border border-slate-200 bg-white"} srcDoc={preview} />
        </div>
      </div>
    </>
  );
}

export function MailTemplatesScreen() {
  return (
    <AuthenticatedShell>
      <MailTemplatesInner />
    </AuthenticatedShell>
  );
}
