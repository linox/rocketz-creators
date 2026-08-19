import { RecurringDetailScreen } from "@/components/screens/RecurringDetailScreen";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <RecurringDetailScreen />;
}
