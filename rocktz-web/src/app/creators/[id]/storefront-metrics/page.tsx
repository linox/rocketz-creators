import { StorefrontMetricsScreen } from "@/components/screens/StorefrontMetricsScreen";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <StorefrontMetricsScreen />;
}
