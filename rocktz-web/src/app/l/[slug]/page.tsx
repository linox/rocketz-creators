import { CompanyLandingClient } from "./CompanyLandingClient";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function Page() {
  return <CompanyLandingClient />;
}
