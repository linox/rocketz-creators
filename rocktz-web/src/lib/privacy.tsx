"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

const HIDE_KEY = "rocktz_hide_values";
const LGPD_KEY = "rocktz_lgpd_accepted";

type PrivacyContextValue = {
  hideValues: boolean;
  toggleHideValues: () => void;
  lgpdAccepted: boolean;
  acceptLgpd: () => void;
  lgpdOpen: boolean;
  openLgpd: () => void;
  closeLgpd: () => void;
  formatCurrency: (value?: number | null) => string;
  formatNumber: (value?: number | null) => string;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const [hideValues, setHideValues] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(true);
  const [lgpdOpen, setLgpdOpen] = useState(false);

  useEffect(() => {
    setHideValues(localStorage.getItem(HIDE_KEY) === "1");
    setLgpdAccepted(localStorage.getItem(LGPD_KEY) === "1");
  }, []);

  const toggleHideValues = useCallback(() => {
    setHideValues((current) => {
      const next = !current;
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const acceptLgpd = useCallback(() => {
    localStorage.setItem(LGPD_KEY, "1");
    setLgpdAccepted(true);
    setLgpdOpen(false);
  }, []);

  const formatCurrency = useCallback(
    (value?: number | null) => {
      if (hideValues) return "R$ •••••";
      if (value == null) return "—";
      return value.toLocaleString(locale, { style: "currency", currency: "BRL" });
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
