"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CreatorPublicStorefront } from "@/components/CreatorPublicStorefront";
import { api } from "@/lib/api";
import { pathSegment } from "@/lib/route-id";
import type { CreatorStorefront } from "@/lib/types";
import { ApiError } from "@/lib/laravel";
import { applyStorefrontDocumentSeo } from "@/lib/creator-storefront-seo";

export function CreatorStorefrontClient() {
  const pathname = usePathname();
  const slug = pathSegment(pathname, "c") ?? (typeof window === "undefined" ? null : pathSegment(window.location.pathname, "c"));
  const { t } = useTranslation("app");
  const [page, setPage] = useState<CreatorStorefront | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    api.publicStorefront(slug)
      .then((res) => {
        setPage(res.data);
        applyStorefrontDocumentSeo(res.data);
      })
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 404 ? t("storefront.unavailable") : t("storefront.loadError"));
      });
  }, [slug, t]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-6 text-center">
        <p className="text-lg font-black text-slate-950">{error}</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-slate-500">
        {t("storefront.loading")}
      </div>
    );
  }

  return <CreatorPublicStorefront page={page} />;
}
