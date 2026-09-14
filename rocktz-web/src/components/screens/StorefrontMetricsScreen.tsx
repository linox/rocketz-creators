"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { StorefrontAnalytics } from "@/components/StorefrontAnalytics";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { numericIdFromBrowser } from "@/lib/route-id";
import type { CreatorStorefront } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

export function StorefrontMetricsPanel({ creatorId }: { creatorId: number }) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [data, setData] = useState<CreatorStorefront | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.creatorStorefront(creatorId)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(alertApiError)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  if (loading || !data) {
    return <p className="text-sm text-slate-500">{tc("loading")}</p>;
  }

  if (!data.eligibility.unlocked) {
    return (
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
    );
  }

  if (!data.stats) {
    return <p className="text-sm text-slate-500">{t("storefront.statsEmptyItems")}</p>;
  }

  return <StorefrontAnalytics stats={data.stats} showIntro={false} />;
}

function StorefrontMetricsRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth();
  const creatorId = numericIdFromBrowser("creators", pathname) ?? user.creator?.id ?? null;

  useEffect(() => {
    if (creatorId) {
      router.replace(`/creators/${creatorId}?tab=storefront-metrics`);
      return;
    }
    router.replace("/dashboard");
  }, [creatorId, router]);

  return null;
}

export function StorefrontMetricsScreen() {
  return (
    <AuthenticatedShell>
      <StorefrontMetricsRedirect />
    </AuthenticatedShell>
  );
}
