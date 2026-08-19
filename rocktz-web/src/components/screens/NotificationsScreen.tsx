"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { AppNotification } from "@/lib/types";

function NotificationsInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [items, setItems] = useState<AppNotification[]>([]);

  async function load() {
    try {
      const res = await api.notifications(user.role === "admin" ? "" : "");
      setItems(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unread = items.filter((item) => !item.read).length;

  return (
    <>
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.unread", { count: unread })}
        actions={<button type="button" className="rounded-xl border px-4 py-2 text-sm font-bold" onClick={async () => { await api.markAllRead(); load(); }}>{t("notifications.markAll")}</button>}
      />
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className={`rounded-2xl border p-4 ${item.read ? "border-slate-200 bg-white" : "border-purple-200 bg-purple-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{item.title}</p>
                <p className="text-sm text-slate-600">{item.message}</p>
                <StatusBadge status={item.type} />
              </div>
              <div className="flex gap-2">
                {item.link ? <Link href={item.link} className="text-xs font-bold text-purple-700">{tc("open")}</Link> : null}
                {!item.read ? <button type="button" className="text-xs font-bold" onClick={async () => { await api.markRead(item.id); load(); }}>{t("notifications.read")}</button> : null}
                <button type="button" className="text-xs font-bold text-rose-600" onClick={async () => { await api.deleteNotification(item.id); load(); }}>{tc("delete")}</button>
              </div>
            </div>
          </article>
        ))}
        {!items.length ? <p className="text-sm text-slate-400">{t("notifications.empty")}</p> : null}
      </div>
    </>
  );
}

export function NotificationsScreen() {
  return <AuthenticatedShell><NotificationsInner /></AuthenticatedShell>;
}
