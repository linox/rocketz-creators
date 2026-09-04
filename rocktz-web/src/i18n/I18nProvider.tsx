"use client";

import { useEffect, type ReactNode } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n, { detectClientLocale, getAppLocale } from "@/i18n/config";
import { normalizeLocale } from "@/i18n/locales";
import { APP_TITLE } from "@/lib/brand";

function DocumentLang({ children }: { children: ReactNode }) {
  const { i18n: instance } = useTranslation();

  useEffect(() => {
    const detected = detectClientLocale();
    document.documentElement.lang = detected;
    if (detected !== normalizeLocale(instance.language)) {
      void instance.changeLanguage(detected);
    }
  }, [instance]);

  useEffect(() => {
    document.documentElement.lang = getAppLocale();
    if (window.location.pathname === "/l" || window.location.pathname.startsWith("/l/")) {
      return;
    }
    const title = document.querySelector("title");
    if (title) {
      title.textContent = APP_TITLE;
    }
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", instance.t("landing:metaDescription"));
    }
  }, [instance, instance.language]);

  return children;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <DocumentLang>{children}</DocumentLang>
    </I18nextProvider>
  );
}
