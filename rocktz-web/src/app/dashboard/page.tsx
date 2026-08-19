import { AuthenticatedShell, ComingSoon } from "@/components/AuthenticatedShell";

export default function DashboardPage() {
  return (
    <AuthenticatedShell>
      <ComingSoon title="Dashboard" />
    </AuthenticatedShell>
  );
}
