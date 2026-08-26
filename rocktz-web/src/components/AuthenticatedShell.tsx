"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { clearToken, fetchMe, getToken, ApiError } from "@/lib/laravel";
import { cacheAuthUser, isUserCacheFresh, peekCachedUser, peekMemoryUser } from "@/lib/session-cache";
import { LOCALE_STORAGE_KEY, normalizeLocale } from "@/i18n/locales";
import { setAppLocale } from "@/i18n/config";
import type { AuthUser } from "@/lib/auth";
import { AuthUserContext } from "@/lib/use-auth";
import { PrivacyProvider } from "@/lib/privacy";

export function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [user, setUser] = useState<AuthUser | null>(() => peekMemoryUser());

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    function applyUser(next: AuthUser) {
      cacheAuthUser(next);
      if (next.locale && !localStorage.getItem(LOCALE_STORAGE_KEY)) {
        void setAppLocale(normalizeLocale(next.locale));
      }
      setUser(next);
    }

    function loadUser(force: boolean) {
      const cached = peekCachedUser();
      if (cached) setUser(cached);

      if (!force && isUserCacheFresh()) {
        return Promise.resolve();
      }

      return fetchMe()
        .then(applyUser)
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            clearToken();
            router.replace("/login");
            return;
          }
          if (!peekCachedUser()) {
            clearToken();
            router.replace("/login");
          }
        });
    }

    void loadUser(false);

    function onAuthRefresh() {
      if (!getToken()) return;
      void fetchMe().then(applyUser).catch(() => undefined);
    }

    window.addEventListener("rocketz:auth-refresh", onAuthRefresh);
    return () => window.removeEventListener("rocketz:auth-refresh", onAuthRefresh);
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] text-sm text-slate-500">
        {t("loading")}
      </div>
    );
  }

  return (
    <AuthUserContext.Provider value={user}>
      <PrivacyProvider>
        <AppShell user={user} onUserChange={(next) => { cacheAuthUser(next); setUser(next); }}>{children}</AppShell>
      </PrivacyProvider>
    </AuthUserContext.Provider>
  );
}

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  const { t } = useTranslation("common");
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">{t("comingSoon")}</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
      <p className="mt-3 max-w-xl text-slate-600">
        {description ?? t("comingSoonBody")}
      </p>
    </div>
  );
}
