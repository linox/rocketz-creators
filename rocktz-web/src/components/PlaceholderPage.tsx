import { AuthenticatedShell, ComingSoon } from "@/components/AuthenticatedShell";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <AuthenticatedShell>
      <ComingSoon title={title} />
    </AuthenticatedShell>
  );
}
