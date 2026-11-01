export type BrowserAlert = {
  key: string;
  kind: "script_sent" | "delivery_received" | "delivery_overdue";
  title: string;
  body: string;
  url: string;
  inbox_id: string | null;
};

export const BROWSER_ALERTS_DISMISS_KEY = "rocketz:browser-alerts-dismissed";

export type BrowserAlertPermission = NotificationPermission | "unsupported";

export function browserAlertPermission(): BrowserAlertPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function ensureAlertServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function requestBrowserAlerts(): Promise<BrowserAlertPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  const result = await Notification.requestPermission();
  if (result === "granted") {
    localStorage.removeItem(BROWSER_ALERTS_DISMISS_KEY);
    await ensureAlertServiceWorker();
    window.dispatchEvent(new Event("rocketz:browser-alerts-refresh"));
  }
  return result;
}

export function browserAlertPath(url: string): string {
  const parsed = new URL(url, window.location.origin);
  parsed.searchParams.delete("alert");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export async function showBrowserAlert(alert: BrowserAlert, onOpen: (url: string, key: string) => void): Promise<void> {
  const registration = await ensureAlertServiceWorker();
  if (registration) {
    await registration.showNotification(alert.title, {
      body: alert.body,
      tag: alert.key,
      renotify: true,
      data: { url: alert.url, key: alert.key },
      icon: "/favicon.svg",
    } as NotificationOptions);
    return;
  }

  const notice = new Notification(alert.title, { body: alert.body, tag: alert.key });
  notice.onclick = () => {
    window.focus();
    notice.close();
    onOpen(alert.url, alert.key);
  };
}
