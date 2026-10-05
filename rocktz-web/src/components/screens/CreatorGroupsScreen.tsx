"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { CompanyCreatorGroupsPanel } from "@/components/CompanyCreatorGroupsPanel";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { Company } from "@/lib/types";

function CreatorGroupsInner() {
  const user = useAuth();
  const router = useRouter();
  const { t } = useTranslation("app");
  const isAdmin = user.role === "admin";
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState(isAdmin ? "" : String(user.company?.id || ""));

  useEffect(() => {
    if (user.role === "creator") {
      router.replace(user.creator?.id ? `/creators/${user.creator.id}?tab=dashboard` : "/");
      return;
    }
    if (!isAdmin) {
      setCompanyId(String(user.company?.id || ""));
      return;
    }
    let cancelled = false;
    api.companies()
      .then((res) => {
        if (cancelled) return;
        setCompanies(res.data);
      })
      .catch((err) => {
        if (!cancelled) void alertApiError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, router, user.company?.id, user.creator?.id, user.role]);

  const selectedCompanyId = Number(companyId) || 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="m-0 text-xl font-bold text-[#0F172A] sm:text-[28px]">{t("creatorGroups.title")}</h1>
          <p className="mt-1 text-[14px] text-[#64748B]">{t("creatorGroups.subtitle")}</p>
        </div>
        <Link href="/creators" className="flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">
          {t("creatorGroups.backToCasting")}
        </Link>
      </header>

      {isAdmin ? (
        <div className="max-w-sm">
          <Select2Field
            theme="light"
            placeholder={t("creatorGroups.companyPh")}
            value={companyId}
            options={companies.map((company) => ({ value: String(company.id), label: company.name }))}
            onChange={setCompanyId}
          />
        </div>
      ) : null}

      {selectedCompanyId ? (
        <CompanyCreatorGroupsPanel key={selectedCompanyId} companyId={selectedCompanyId} />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("creatorGroups.pickCompany")}</p>
      )}
    </div>
  );
}

export function CreatorGroupsScreen() {
  return (
    <AuthenticatedShell>
      <CreatorGroupsInner />
    </AuthenticatedShell>
  );
}
