"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import {
  BROWSER_ALERTS_DISMISS_KEY,
  browserAlertPath,
  browserAlertPermission,
  requestBrowserAlerts,
  showBrowserAlert,
  type BrowserAlertPermission,
} from "@/lib/browser-alerts";

const POLL_MS = 15 * 1000;

export function BrowserAlerts() {
  const { t } = useTranslation("app");
  const router = useRouter();
  const pathname = usePathname();
  const [permission, setPermission] = useState<BrowserAlertPermission>("unsupported");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setPermission(browserAlertPermission());
    setDismissed(localStorage.getItem(BROWSER_ALERTS_DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("alert");
    if (!key) return;
    void api.markBrowserAlertSeen({ key }).catch(() => undefined);
    const next = new URLSearchParams(params);
    next.delete("alert");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router]);

  useEffect(() => {
    function open(url: string, key: string) {
      if (key) void api.markBrowserAlertSeen({ key }).catch(() => undefined);
      router.push(browserAlertPath(url));
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string; key?: string } | null;
      if (!data || data.type !== "rocketz-browser-alert" || typeof data.url !== "string") return;
      open(data.url, typeof data.key === "string" ? data.key : "");
    }

    let timer = 0;
    let stopped = false;

    async function pull() {
      if (stopped || browserAlertPermission() !== "granted") return;
      try {
        const res = await api.browserAlerts();
        for (const alert of res.data) {
          await showBrowserAlert(alert, open);
        }
      } catch {
        /* the next poll retries */
      }
    }

    function start() {
      void pull();
      timer = window.setInterval(() => {
        void pull();
      }, POLL_MS);
    }

    function onRefresh() {
      setPermission(browserAlertPermission());
      setDismissed(false);
      if (!timer) start();
      else void pull();
    }

    function onVisible() {
      if (document.visibilityState === "visible") void pull();
    }

    if (browserAlertPermission() === "granted") start();
    window.addEventListener("rocketz:browser-alerts-refresh", onRefresh);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("rocketz:browser-alerts-refresh", onRefresh);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  async function enable() {
    const next = await requestBrowserAlerts();
    setPermission(next);
    if (next === "granted") setDismissed(false);
  }

  function later() {
    localStorage.setItem(BROWSER_ALERTS_DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (permission !== "default" || dismissed) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-slate-900">{t("mail.browserTitle")}</p>
        <p className="mt-1 text-sm text-slate-500">{t("mail.browserHint")}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={later} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">
          {t("mail.browserLater")}
        </button>
        <button type="button" onClick={() => void enable()} className="rounded-xl bg-brand-primary px-3 py-2 text-sm font-bold text-white">
          {t("mail.browserEnable")}
        </button>
      </div>
    </div>
  );
}
