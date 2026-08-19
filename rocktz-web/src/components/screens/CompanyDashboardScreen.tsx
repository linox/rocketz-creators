"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, money } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { Campaign, Company, Creator, RecurringContract } from "@/lib/types";

function CompanyInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const companyId = user.company?.id;
  const [company, setCompany] = useState<Company | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recurring, setRecurring] = useState<RecurringContract[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [tab, setTab] = useState<"overview" | "campaigns" | "recurring" | "favorites">("overview");

  useEffect(() => {
    if (!companyId) return;
    api.company(companyId).then((res) => setCompany(res.data)).catch(alertApiError);
    api.campaigns().then((res) => setCampaigns(res.data)).catch(alertApiError);
    api.recurring().then((res) => setRecurring(res.data)).catch(alertApiError);
    api.creators("?status=active").then((res) => setCreators(res.data)).catch(alertApiError);
  }, [companyId]);

  const favorites = creators.filter((creator) => company?.favorite_creator_ids?.includes(creator.id));
  const tabLabels: Record<typeof tab, string> = {
    overview: t("companyDash.overview"),
    campaigns: t("companyDash.campaigns"),
    recurring: t("companyDash.recurring"),
    favorites: t("companyDash.favorites"),
  };

  if (!companyId) {
    return <p className="text-sm text-slate-500">{t("companyDash.noCompany")}</p>;
  }

  return (
    <>
      <PageHeader title={company?.name ?? t("companyDash.title")} subtitle={t("companyDash.subtitle")} />
      <div className="mb-5 flex flex-wrap gap-2">
        {(["overview", "campaigns", "recurring", "favorites"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize ${tab === item ? "bg-purple-600 text-white" : "bg-slate-100"}`}>{tabLabels[item]}</button>
        ))}
      </div>
      {tab === "overview" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t("companyDash.campaigns")} value={campaigns.length} />
          <StatCard label={t("companyDash.investment")} value={money(campaigns.reduce((sum, c) => sum + (c.total_budget ?? 0), 0))} />
          <StatCard label={t("companyDash.favorites")} value={favorites.length} />
        </div>
      ) : null}
      {tab === "campaigns" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="rounded-2xl border bg-white p-5">
              <div className="flex justify-between"><h3 className="font-black">{campaign.name}</h3><StatusBadge status={campaign.status} /></div>
            </Link>
          ))}
        </div>
      ) : null}
      {tab === "recurring" ? (
        <div className="space-y-3">
          {recurring.map((row) => (
            <Link key={row.id} href={`/recurring/${row.id}`} className="block rounded-2xl border bg-white p-5">
              <div className="flex justify-between"><h3 className="font-black">{row.title}</h3><StatusBadge status={row.status} /></div>
            </Link>
          ))}
        </div>
      ) : null}
      {tab === "favorites" && company ? (
        <div className="grid gap-4 md:grid-cols-2">
          {creators.map((creator) => {
            const fav = company.favorite_creator_ids?.includes(creator.id);
            return (
              <article key={creator.id} className="rounded-2xl border bg-white p-5">
                <h3 className="font-black">@{creator.artistic_name}</h3>
                <p className="text-sm text-slate-500">{creator.city}/{creator.state}</p>
                <button type="button" className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-bold ${fav ? "bg-purple-600 text-white" : "border"}`} onClick={async () => {
                  try {
                    const res = await api.toggleFavorite(company.id, creator.id);
                    setCompany(res.data);
                  } catch (err) {
                    await alertApiError(err);
                  }
                }}>{fav ? t("companyDash.favorite") : t("companyDash.favor")}</button>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

export function CompanyDashboardScreen() {
  return <AuthenticatedShell><CompanyInner /></AuthenticatedShell>;
}
