"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import { laravelFetch } from "@/lib/laravel";
import { resolveCurrency } from "@/lib/geo";
import { cacheAuthUser } from "@/lib/session-cache";
import type { AuthUser } from "@/lib/auth";

const HIDE_KEY = "rocktz_hide_values";
export const LGPD_KEY = "rocktz_lgpd_accepted";

export function persistLgpdAccepted(userId?: number | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LGPD_KEY, "1");
    if (userId) localStorage.setItem(`${LGPD_KEY}:${userId}`, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function readLgpdAccepted(userId?: number | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (userId && localStorage.getItem(`${LGPD_KEY}:${userId}`) === "1") return true;
    return localStorage.getItem(LGPD_KEY) === "1";
  } catch {
    return false;
  }
}

type PrivacyContextValue = {
  hideValues: boolean;
  toggleHideValues: () => void;
  lgpdAccepted: boolean;
  acceptLgpd: () => void;
  lgpdOpen: boolean;
  openLgpd: () => void;
  closeLgpd: () => void;
  formatCurrency: (value?: number | null, currency?: string | null) => string;
  formatNumber: (value?: number | null) => string;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({
  children,
  userId,
  serverLgpdAccepted = false,
}: {
  children: ReactNode;
  userId?: number;
  serverLgpdAccepted?: boolean;
}) {
  const { i18n } = useTranslation();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const [hideValues, setHideValues] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(() => serverLgpdAccepted || readLgpdAccepted(userId));
  const [lgpdOpen, setLgpdOpen] = useState(false);

  useEffect(() => {
    setHideValues(localStorage.getItem(HIDE_KEY) === "1");
    if (serverLgpdAccepted) {
      persistLgpdAccepted(userId);
      setLgpdAccepted(true);
      return;
    }
    setLgpdAccepted(readLgpdAccepted(userId));
  }, [serverLgpdAccepted, userId]);

  const toggleHideValues = useCallback(() => {
    setHideValues((current) => {
      const next = !current;
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const acceptLgpd = useCallback(() => {
    persistLgpdAccepted(userId);
    setLgpdAccepted(true);
    setLgpdOpen(false);
    void laravelFetch<{ user: AuthUser }>("/auth/lgpd", { method: "POST" })
      .then((payload) => {
        if (payload.user) cacheAuthUser(payload.user);
      })
      .catch(() => undefined);
  }, [userId]);

  const formatCurrency = useCallback(
    (value?: number | null, currency?: string | null) => {
      const code = resolveCurrency(currency);
      if (hideValues) {
        try {
          const symbol = new Intl.NumberFormat(locale, { style: "currency", currency: code })
            .formatToParts(0)
            .find((part) => part.type === "currency")?.value;
          return `${symbol || code} •••••`;
        } catch {
          return `${code} •••••`;
        }
      }
      if (value == null) return "—";
      try {
        return value.toLocaleString(locale, { style: "currency", currency: code });
      } catch {
        return value.toLocaleString(locale, { style: "currency", currency: "BRL" });
      }
    },
    [hideValues, locale],
  );

  const formatNumber = useCallback((value?: number | null) => {
    if (value == null) return "0";
    return value.toLocaleString(locale);
  }, [locale]);

  const value = useMemo(
    () => ({
      hideValues,
      toggleHideValues,
      lgpdAccepted,
      acceptLgpd,
      lgpdOpen,
      openLgpd: () => setLgpdOpen(true),
      closeLgpd: () => setLgpdOpen(false),
      formatCurrency,
      formatNumber,
    }),
    [hideValues, toggleHideValues, lgpdAccepted, acceptLgpd, lgpdOpen, formatCurrency, formatNumber],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy requires PrivacyProvider");
  return ctx;
}
