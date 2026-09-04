import type { Metadata } from "next";
import { CompanyLandingClient } from "./CompanyLandingClient";
import { fetchPublicLanding, metadataFromLanding } from "@/lib/company-landing-seo";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublicLanding(slug);
  if (!page) {
    return {};
  }

  return metadataFromLanding(page);
}

export default function Page() {
  return <CompanyLandingClient />;
}
