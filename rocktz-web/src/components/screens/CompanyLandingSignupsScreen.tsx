"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import type { CompanyLandingSignup } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function CompanyLandingSignupsInner() {
  const user = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isAdmin = user.role === "admin";
  const queryCompanyId = Number(searchParams.get("companyId") || 0);
  const companyId = isAdmin ? queryCompanyId || 0 : (user.company?.id ?? 0);
  const [rows, setRows] = useState<CompanyLandingSignup[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin && !companyId) {
      api.companies().then((res) => {
        const first = res.data[0];
        if (first) router.replace(`/company-landing/signups?companyId=${first.id}`);
      }).catch(alertApiError).finally(() => setLoading(false));
      return;
    }
    if (!companyId) {
      setLoading(false);
      return;
    }
    api.companyLandingSignups(companyId)
      .then((res) => setRows(res.data))
      .catch(alertApiError)
      .finally(() => setLoading(false));
  }, [companyId, isAdmin, router]);

  const filtered = useMemo(
    () => rows.filter((row) => status === "all" || row.status === status),
    [rows, status],
  );

  const statusOptions = [
    { value: "all", label: t("companyLanding.signups.all") },
    { value: "pending", label: t("status.pending") },
    { value: "reviewing", label: t("status.reviewing") },
    { value: "approved", label: t("status.approved") },
    { value: "rejected", label: t("status.rejected") },
  ];

  return (
    <div>
      <PageHeader
        title={t("companyLanding.signups.title")}
        subtitle={t("companyLanding.signups.subtitle")}
        actions={
          <Link href={`/company-landing${isAdmin ? `?companyId=${companyId}` : ""}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700">
            {t("companyLanding.signups.back")}
          </Link>
        }
      />
      <div className="mb-4 max-w-xs">
        <Select2Field theme="light" value={status} options={statusOptions} onChange={setStatus} />
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">{t("companyLanding.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("companyLanding.signups.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">{t("companyLanding.signups.colCreator")}</th>
                <th className="px-4 py-3">{t("companyLanding.signups.colOrigin")}</th>
                <th className="px-4 py-3">{t("companyLanding.signups.colDate")}</th>
                <th className="px-4 py-3">{t("companyLanding.signups.colStatus")}</th>
                <th className="px-4 py-3">{t("companyLanding.signups.colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={row.creator?.photo_url} name={row.creator?.artistic_name || row.creator?.full_name} size="custom" className="h-9 w-9" textClassName="text-xs" />
                      <div>
                        <p className="font-bold text-slate-900">@{row.creator?.artistic_name}</p>
                        {row.creator?.socials?.instagram ? (
                          <p className="text-xs text-slate-500">{row.creator.socials.instagram}</p>
                        ) : row.creator?.full_name ? (
                          <p className="text-xs text-slate-500">{row.creator.full_name}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">{t("companyLanding.signups.origin")}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString(locale) : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/creators/${row.creator_id}?from=landing`}
                      className="text-xs font-bold text-brand-primary hover:underline"
                    >
                      {row.status === "approved" || row.status === "rejected" ? t("companyLanding.signups.view") : t("companyLanding.signups.analyze")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CompanyLandingSignupsScreen() {
  return (
    <AuthenticatedShell>
      <Suspense fallback={<div className="flex h-64 items-center justify-center text-sm text-slate-500">...</div>}>
        <CompanyLandingSignupsInner />
      </Suspense>
    </AuthenticatedShell>
  );
}
