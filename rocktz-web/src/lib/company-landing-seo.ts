import type { Metadata } from "next";
import { APP_TITLE } from "@/lib/brand";
import type { CompanyLandingPage } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function fetchPublicLanding(slug: string): Promise<CompanyLandingPage | null> {
  if (!slug || slug === "_") {
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/landings/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as { data?: CompanyLandingPage };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export function metadataFromLanding(page: CompanyLandingPage): Metadata {
  const seo = page.seo;
  const title = seo?.title || `Creatorz - ${page.display_name || page.company?.name || ""}`.trim();
  const description = seo?.description || page.description || "";
  const url = seo?.url;
  const image = seo?.image || page.banner_url || page.logo_url || undefined;

  return {
    title: { absolute: title },
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      type: "website",
      siteName: APP_TITLE,
      title,
      description,
      url,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export function applyCompanyLandingDocumentSeo(page: CompanyLandingPage) {
  if (typeof document === "undefined") {
    return;
  }

  const meta = metadataFromLanding(page);
  const title = typeof meta.title === "object" && meta.title && "absolute" in meta.title ? meta.title.absolute : "";
  if (typeof title === "string" && title) {
    document.title = title;
  }

  const description = meta.description;
  if (typeof description === "string") {
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", description);
  }
}
