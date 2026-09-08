"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Store } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";

function StorefrontSettingsForm() {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const router = useRouter();
  const user = useAuth();
  const [value, setValue] = useState("3");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    api.storefrontSettings()
      .then((res) => setValue(String(res.data.min_completed_campaigns)))
      .catch(alertApiError)
      .finally(() => setLoading(false));
  }, [router, user.role]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > 99) {
      await alertWarning(t("storefront.settingsInvalidTitle"), t("storefront.settingsInvalid"));
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateStorefrontSettings({ min_completed_campaigns: count });
      setValue(String(res.data.min_completed_campaigns));
      await alertSuccess(t("storefront.settingsTitle"), res.message || t("storefront.settingsSaved"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  if (user.role !== "admin") {
    return null;
  }

  return (
    <>
      <PageHeader title={t("storefront.settingsTitle")} subtitle={t("storefront.settingsSubtitle")} />
      <form noValidate onSubmit={save} className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-brand-primary">
          <Store size={20} />
          <h2 className="text-sm font-black tracking-wider uppercase">{t("storefront.settingsField")}</h2>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-slate-500">{t("storefront.settingsHint")}</p>
        <label className="mb-1 block text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("storefront.settingsField")}</label>
        <input
          inputMode="numeric"
          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-900"
          value={value}
          disabled={loading || saving}
          onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 2))}
        />
        <div className="mt-5 flex justify-end">
          <button type="submit" disabled={loading || saving} className="h-11 rounded-xl bg-brand-primary px-5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60">
            {saving ? tc("saving") : tc("save")}
          </button>
        </div>
      </form>
    </>
  );
}

export function StorefrontSettingsScreen() {
  return (
    <AuthenticatedShell>
      <StorefrontSettingsForm />
    </AuthenticatedShell>
  );
}
