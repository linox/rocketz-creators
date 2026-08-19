import { CampaignDetailScreen } from "@/components/screens/CampaignDetailScreen";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <CampaignDetailScreen />;
}
