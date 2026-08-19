"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import type { Campaign, RecurringContract } from "@/lib/types";

function DeliveriesInner() {
  const { t } = useTranslation("app");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recurring, setRecurring] = useState<RecurringContract[]>([]);
  const [tab, setTab] = useState<"campanhas" | "recorrentes">("campanhas");

  useEffect(() => {
    api.campaigns().then((res) => setCampaigns(res.data)).catch(alertApiError);
    api.recurring().then((res) => setRecurring(res.data)).catch(alertApiError);
  }, []);

  return (
    <>
      <PageHeader title={t("deliveries.title")} subtitle={t("deliveries.subtitle")} />
      <div className="mb-5 flex gap-2">
        <button type="button" onClick={() => setTab("campanhas")} className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === "campanhas" ? "bg-purple-600 text-white" : "bg-slate-100"}`}>{t("deliveries.campaigns")}</button>
        <button type="button" onClick={() => setTab("recorrentes")} className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === "recorrentes" ? "bg-purple-600 text-white" : "bg-slate-100"}`}>{t("deliveries.recurring")}</button>
      </div>
      {tab === "campanhas" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="rounded-2xl border bg-white p-5">
              <div className="flex justify-between">
                <h3 className="font-black">{campaign.name}</h3>
                <StatusBadge status={campaign.status} />
              </div>
              <p className="text-sm text-slate-500">{campaign.company?.name}</p>
            </Link>
          ))}
          {!campaigns.length ? <p className="text-sm text-slate-400">{t("campaigns.none")}</p> : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recurring.map((row) => (
            <Link key={row.id} href={`/recurring/${row.id}`} className="rounded-2xl border bg-white p-5">
              <div className="flex justify-between">
                <h3 className="font-black">{row.title}</h3>
                <StatusBadge status={row.status} />
              </div>
              <p className="text-sm text-slate-500">{row.company?.name}</p>
            </Link>
          ))}
          {!recurring.length ? <p className="text-sm text-slate-400">{t("deliveries.noRecurring")}</p> : null}
        </div>
      )}
    </>
  );
}

export function CampaignDeliveriesScreen() {
  return <AuthenticatedShell><DeliveriesInner /></AuthenticatedShell>;
}
