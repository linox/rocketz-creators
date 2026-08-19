"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  normalizeLocale,
  type AppLocale,
} from "@/i18n/locales";
import appEn from "@/i18n/locales/en/app.json";
import authEn from "@/i18n/locales/en/auth.json";
import commonEn from "@/i18n/locales/en/common.json";
import landingEn from "@/i18n/locales/en/landing.json";
import navEn from "@/i18n/locales/en/nav.json";
import profileEn from "@/i18n/locales/en/profile.json";
import appEs from "@/i18n/locales/es/app.json";
import authEs from "@/i18n/locales/es/auth.json";
import commonEs from "@/i18n/locales/es/common.json";
import landingEs from "@/i18n/locales/es/landing.json";
import navEs from "@/i18n/locales/es/nav.json";
import profileEs from "@/i18n/locales/es/profile.json";
import appPt from "@/i18n/locales/pt-BR/app.json";
import authPt from "@/i18n/locales/pt-BR/auth.json";
import commonPt from "@/i18n/locales/pt-BR/common.json";
import landingPt from "@/i18n/locales/pt-BR/landing.json";
import navPt from "@/i18n/locales/pt-BR/nav.json";
import profilePt from "@/i18n/locales/pt-BR/profile.json";

const NAMESPACES = ["common", "auth", "landing", "nav", "profile", "app"] as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      "pt-BR": {
        common: commonPt,
        auth: authPt,
        landing: landingPt,
        nav: navPt,
        profile: profilePt,
        app: appPt,
      },
      en: {
        common: commonEn,
        auth: authEn,
        landing: landingEn,
        nav: navEn,
        profile: profileEn,
        app: appEn,
      },
      es: {
        common: commonEs,
        auth: authEs,
        landing: landingEs,
        nav: navEs,
        profile: profileEs,
        app: appEs,
      },
    },
    lng: DEFAULT_LOCALE,
    fallbackLng: "en",
    supportedLngs: [...LOCALES],
    ns: [...NAMESPACES],
    defaultNS: "common",
    returnObjects: true,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

if (typeof window === "undefined") {
  void i18n.changeLanguage(DEFAULT_LOCALE);
}

export function detectClientLocale(): AppLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) {
    return normalizeLocale(stored);
  }
  return normalizeLocale(navigator.language);
}

export function getAppLocale(): AppLocale {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      return normalizeLocale(stored);
    }
  }
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE);
}

export async function setAppLocale(locale: AppLocale) {
  const next = normalizeLocale(locale);
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = next;
  }
  await i18n.changeLanguage(next);
}

export default i18n;
