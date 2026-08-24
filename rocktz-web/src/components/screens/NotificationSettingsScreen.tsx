"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess } from "@/lib/alerts";

const FLAGS = ["opportunities", "campaign_updates", "new_demands", "deadline_reminders", "delivery_updates", "promotional"] as const;

type Prefs = Record<(typeof FLAGS)[number], boolean>;

function SettingsForm() {
  const { t } = useTranslation("app");
  const params = useSearchParams();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.notificationPreferences()
      .then((res) => setPrefs(res.data))
      .catch(alertApiError);
  }, []);

  useEffect(() => {
    if (params.get("unsubscribed") === "1") {
      void alertSuccess(t("mail.settingsTitle"), t("mail.unsubscribed"));
    }
  }, [params, t]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await api.updateNotificationPreferences(prefs);
      setPrefs(res.data);
      await alertSuccess(t("mail.settingsTitle"), t("mail.prefsSaved"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title={t("mail.settingsTitle")} subtitle={t("mail.settingsSubtitle")} />
      <form noValidate onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">{t("mail.operationalNote")}</p>
        {prefs ? FLAGS.map((flag) => (
          <label key={flag} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-brand-primary"
              checked={prefs[flag]}
              onChange={(e) => setPrefs({ ...prefs, [flag]: e.target.checked })}
            />
            <span className="text-sm font-semibold text-slate-800">{t(`mail.${flag}`)}</span>
          </label>
        )) : null}
        <button type="submit" disabled={!prefs || saving} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {t("mail.savePrefs")}
        </button>
      </form>
    </>
  );
}

export function NotificationSettingsScreen() {
  return (
    <AuthenticatedShell>
      <Suspense>
        <SettingsForm />
      </Suspense>
    </AuthenticatedShell>
  );
}
