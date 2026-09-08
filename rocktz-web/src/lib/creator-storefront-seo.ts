import type { Metadata } from "next";
import { APP_TITLE } from "@/lib/brand";
import type { CreatorStorefront } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function fetchPublicStorefront(id: string): Promise<CreatorStorefront | null> {
  if (!id || id === "_") {
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/storefronts/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as { data?: CreatorStorefront };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export function metadataFromStorefront(page: CreatorStorefront): Metadata {
  const seo = page.seo;
  const title = seo?.title || `${page.creator.artistic_name} | Creatorz`;
  const description = seo?.description || page.creator.bio || "";
  const url = seo?.url;
  const image = seo?.image || page.banner_url || page.creator.photo_url || undefined;

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

export function applyStorefrontDocumentSeo(page: CreatorStorefront) {
  if (typeof document === "undefined") {
    return;
  }

  const meta = metadataFromStorefront(page);
  const title = typeof meta.title === "object" && meta.title && "absolute" in meta.title ? meta.title.absolute : "";
  if (typeof title === "string" && title) {
    document.title = title;
  }
}
