"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { homePathForUser } from "@/lib/auth";
import { clearToken, fetchMe, setToken } from "@/lib/laravel";
import { useTranslation } from "react-i18next";

function GoogleCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useTranslation("common");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      router.replace("/login?error=google_failed");
      return;
    }

    setToken(token);
    fetchMe()
      .then((user) => {
        if (params.get("signup") === "1" && user.role === "creator" && user.creator?.id) {
          router.replace(`/creators/${user.creator.id}?tab=portfolio`);
          return;
        }
        router.replace(homePathForUser(user));
      })
      .catch(() => {
        clearToken();
        router.replace("/login?error=google_failed");
      });
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-sm text-slate-400">
      {t("connectingAccount")}
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallback />
    </Suspense>
  );
}
