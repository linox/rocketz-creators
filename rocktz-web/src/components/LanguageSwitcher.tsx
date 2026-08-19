"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getToken, laravelFetch } from "@/lib/laravel";
import { setAppLocale } from "@/i18n/config";
import { LOCALES, LOCALE_LABELS, normalizeLocale, type AppLocale } from "@/i18n/locales";

type LanguageSwitcherProps = {
  theme?: "light" | "dark";
  className?: string;
};

export function LanguageSwitcher({ theme = "light", className }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation("common");
  const current = normalizeLocale(i18n.language);
  const dark = theme === "dark";

  async function pick(locale: AppLocale) {
    await setAppLocale(locale);
    if (getToken()) {
      await laravelFetch("/auth/locale", {
        method: "PATCH",
        body: JSON.stringify({ locale }),
      }).catch(() => undefined);
    }
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border p-0.5 text-[11px] font-bold tracking-wide",
        dark ? "border-white/15 bg-white/5 text-slate-300" : "border-slate-200 bg-white text-slate-500",
        className,
      )}
      role="group"
      aria-label={t("language")}
    >
      {LOCALES.map((locale) => {
        const active = current === locale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => pick(locale)}
            className={cn(
              "rounded-md px-2 py-1",
              active
                ? dark
                  ? "bg-white/15 text-white"
                  : "bg-purple-600 text-white"
                : dark
                  ? "hover:text-white"
                  : "hover:text-purple-700",
            )}
          >
            {LOCALE_LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
