"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BarChart3, Store } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { StorefrontAnalytics } from "@/components/StorefrontAnalytics";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { numericIdFromPath } from "@/lib/route-id";
import type { CreatorStorefront } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function StorefrontMetricsInner() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const creatorId = numericIdFromPath(pathname, "creators");
  const [data, setData] = useState<CreatorStorefront | null>(null);
  const [loading, setLoading] = useState(true);

  const canView = Boolean(
    creatorId && (user.role === "admin" || user.creator?.id === creatorId),
  );

  useEffect(() => {
    if (!creatorId) {
      router.replace("/dashboard");
      return;
    }
    if (user.role !== "admin" && user.creator?.id !== creatorId) {
      router.replace(user.creator?.id ? `/creators/${user.creator.id}/storefront-metrics` : "/dashboard");
      return;
    }
    setLoading(true);
    api.creatorStorefront(creatorId)
      .then((res) => setData(res.data))
      .catch(alertApiError)
      .finally(() => setLoading(false));
  }, [creatorId, router, user.creator?.id, user.role]);

  if (!canView) {
    return null;
  }

  const name = data?.creator.artistic_name;
  const configHref = `/creators/${creatorId}?tab=storefront`;

  return (
    <>
      <PageHeader
        title={t("storefront.metricsTitle")}
        subtitle={name ? t("storefront.metricsSubtitleNamed", { name }) : t("storefront.metricsSubtitle")}
        actions={
          <Link href={configHref} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <Store size={14} /> {t("storefront.configureStorefront")}
          </Link>
        }
      />
      {loading || !data ? (
        <p className="text-sm text-slate-500">{tc("loading")}</p>
      ) : !data.eligibility.unlocked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="mb-2 flex items-center gap-2 text-amber-800">
            <BarChart3 size={20} />
            <h3 className="text-lg font-bold">{t("storefront.lockedTitle")}</h3>
          </div>
          <p className="text-sm leading-relaxed text-amber-900/80">
            {t("storefront.lockedBody", {
              required: data.eligibility.required_campaigns,
              completed: data.eligibility.completed_campaigns,
              remaining: data.eligibility.remaining_campaigns,
            })}
          </p>
        </div>
      ) : data.stats ? (
        <StorefrontAnalytics stats={data.stats} showIntro={false} />
      ) : (
        <p className="text-sm text-slate-500">{t("storefront.statsEmptyItems")}</p>
      )}
    </>
  );
}

export function StorefrontMetricsScreen() {
  return (
    <AuthenticatedShell>
      <StorefrontMetricsInner />
    </AuthenticatedShell>
  );
}
