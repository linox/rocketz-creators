"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { homePathForUser } from "@/lib/auth";
import { useAuth } from "@/lib/use-auth";

function CreatorDashboardRedirect() {
  const user = useAuth();
  const router = useRouter();

  useEffect(() => {
    router.replace(homePathForUser(user));
  }, [router, user]);

  return (
    <div className="flex h-96 items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
    </div>
  );
}

export default function CreatorDashboardPage() {
  return (
    <AuthenticatedShell>
      <CreatorDashboardRedirect />
    </AuthenticatedShell>
  );
}
