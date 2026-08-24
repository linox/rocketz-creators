"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CompanyPublicLanding } from "@/components/CompanyPublicLanding";
import { api } from "@/lib/api";
import { pathSegment } from "@/lib/route-id";
import type { CompanyLandingPage } from "@/lib/types";
import { ApiError } from "@/lib/laravel";

export function CompanyLandingClient() {
  const pathname = usePathname();
  const slug = pathSegment(pathname, "l") ?? (typeof window === "undefined" ? null : pathSegment(window.location.pathname, "l"));
  const { t } = useTranslation("landing");
  const [page, setPage] = useState<CompanyLandingPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    api.publicLanding(slug)
      .then((res) => setPage(res.data))
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 404 ? t("companyLanding.unavailable") : t("companyLanding.loadError"));
      });
  }, [slug, t]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFDFE] px-6 text-center">
        <p className="text-lg font-black text-slate-950">{error}</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFDFE] text-sm text-slate-500">
        {t("companyLanding.loading")}
      </div>
    );
  }

  return <CompanyPublicLanding page={page} />;
}
