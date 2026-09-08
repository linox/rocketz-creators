import type { Metadata } from "next";
import { CreatorStorefrontClient } from "./CreatorStorefrontClient";
import { fetchPublicStorefront, metadataFromStorefront } from "@/lib/creator-storefront-seo";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublicStorefront(slug);
  if (!page) {
    return {};
  }

  return metadataFromStorefront(page);
}

export default function Page() {
  return <CreatorStorefrontClient />;
}
