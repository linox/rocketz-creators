"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Globe, Instagram, Linkedin, X, Youtube } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CreatorSignupForm, creatorModalInput } from "@/components/CreatorSignupForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PasswordField } from "@/components/PasswordField";
import { RocketzLogo } from "@/components/RocketzLogo";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import type { AuthPayload, AuthUser, TwoFactorChallenge } from "@/lib/auth";
import { homePathForUser, isTwoFactorChallenge } from "@/lib/auth";
import { TwoFactorForm } from "@/components/TwoFactorForm";
import { api } from "@/lib/api";
import { getAppLocale } from "@/i18n/config";
import { attachLandingOrigin, setLandingOrigin } from "@/lib/landing-origin";
import { clearToken, fetchMe, getToken, laravelFetch, persistAuth } from "@/lib/laravel";
import { mediaPublicUrl } from "@/lib/media-playback";
import { isValidEmail } from "@/lib/masks";
import type { CompanyLandingPage } from "@/lib/types";

type Modal = "none" | "creator" | "login";

function socialHref(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

export function CompanyPublicLanding({
  page,
  preview = false,
}: {
  page: CompanyLandingPage;
  preview?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const { t: ta } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const [modal, setModal] = useState<Modal>("none");
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);

  const name = page.display_name || page.company?.name || "";
  const title = page.title?.trim() || t("companyLanding.defaultTitle", { name });
  const description = page.description?.trim() || t("companyLanding.defaultDescription", { name });
  const cta = page.cta_text?.trim() || t("companyLanding.defaultCta");
  const primary = page.primary_color || "#8A3FFC";
  const button = page.button_color || primary;
  const background = page.background_color || "#FDFDFE";
  const socials = page.socials ?? {};
  const logoSrc = mediaPublicUrl(page.logo_url);
  const bannerSrc = mediaPublicUrl(page.banner_url);

  useEffect(() => {
    if (!preview && page.slug) {
      setLandingOrigin(page.slug);
      void api.trackLandingEvent(page.slug, "view").catch(() => undefined);
    }
  }, [page.slug, preview]);

  useEffect(() => {
    document.body.style.overflow = modal !== "none" ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [modal]);

  useEffect(() => {
    if (!getToken()) return;
    fetchMe()
      .then(setSessionUser)
      .catch(() => clearToken());
  }, []);

  async function openSignup() {
    if (!preview && page.slug) {
      void api.trackLandingEvent(page.slug, "cta_click").catch(() => undefined);
      void api.trackLandingEvent(page.slug, "signup_started").catch(() => undefined);
    }

    if (sessionUser?.role === "creator") {
      if (preview) return;
      try {
        await api.claimLanding(page.slug);
        await alertSuccess(t("companyLanding.claimedTitle"), t("companyLanding.claimedBody", { name }));
        router.push(homePathForUser(sessionUser));
      } catch (err) {
        await alertApiError(err);
      }
      return;
    }

    setModal("creator");
  }

  async function afterAuth(payload: AuthPayload) {
    const path = persistAuth(payload, payload.user.role === "creator");
    await attachLandingOrigin(payload.user);
    router.push(path);
  }

  async function onLoginSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(login.email) || !login.password) {
      await alertWarning(tc("alerts.incompleteTitle"), ta("loginIncomplete"));
      return;
    }
    setLoading(true);
    try {
      const payload = await laravelFetch<AuthPayload>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: login.email, password: login.password, locale: getAppLocale() }),
      });
      if (isTwoFactorChallenge(payload)) {
        setChallenge(payload);
        return;
      }
      await afterAuth(payload);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col font-sans antialiased" style={{ backgroundColor: background }}>
      {preview ? (
        <div className="bg-amber-500 px-4 py-2 text-center text-xs font-bold text-white">
          {t("companyLanding.previewBanner")}
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={name} referrerPolicy="no-referrer" className="h-10 w-10 rounded-xl object-cover sm:h-12 sm:w-12" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white sm:h-12 sm:w-12" style={{ backgroundColor: primary }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <p className="truncate text-base font-black text-slate-950 sm:text-lg">{name}</p>
          </div>
          <LanguageSwitcher theme="light" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        {bannerSrc ? (
          <div className="mb-8 overflow-hidden rounded-3xl border border-black/5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerSrc} alt="" referrerPolicy="no-referrer" className="h-48 w-full object-cover sm:h-72" />
          </div>
        ) : (
          <div className="mb-8 h-40 rounded-3xl sm:h-56" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${button} 100%)` }} />
        )}

        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
          <p className="mt-5 text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">{description}</p>
          <button
            type="button"
            onClick={() => void openSignup()}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
            style={{ backgroundColor: button }}
          >
            {cta} <ArrowRight size={16} />
          </button>
          <p className="mt-4 text-sm text-slate-500">
            {t("companyLanding.alreadyAccount")}{" "}
            <button type="button" className="font-bold" style={{ color: primary }} onClick={() => setModal("login")}>
              {ta("login")}
            </button>
          </p>
        </div>

        <div className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-3">
          {socials.instagram ? (
            <a href={socialHref(socials.instagram) ?? "#"} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-950">
              <Instagram size={16} />
            </a>
          ) : null}
          {socials.youtube ? (
            <a href={socialHref(socials.youtube) ?? "#"} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-950">
              <Youtube size={16} />
            </a>
          ) : null}
          {socials.linkedin ? (
            <a href={socialHref(socials.linkedin) ?? "#"} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-950">
              <Linkedin size={16} />
            </a>
          ) : null}
          {page.website_url ? (
            <a href={socialHref(page.website_url) ?? "#"} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-950">
              <Globe size={16} />
            </a>
          ) : null}
        </div>
      </main>

      <footer className="border-t border-black/5 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-400 sm:flex-row sm:px-6">
          <p>{t("companyLanding.poweredBy")}</p>
          <RocketzLogo variant="light" size="sm" href="/" showSubtitle={false} />
        </div>
      </footer>

      <AnimatePresence>
        {modal !== "none" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-0 backdrop-blur-sm sm:p-4">
            <motion.div initial={{ y: 24, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="app-modal-panel relative my-0 max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-none border-0 bg-white p-5 shadow-2xl sm:my-8 sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-slate-200 sm:p-8">
              <button type="button" onClick={() => { setModal("none"); setChallenge(null); }} className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={20} />
              </button>
              {modal === "creator" ? (
                <>
                  <CreatorSignupForm
                    landingSlug={page.slug}
                    hideInviteCode
                    accentColor={button}
                    onSuccess={(payload) => void afterAuth(payload)}
                  />
                  <p className="mt-4 text-center text-sm text-slate-500">
                    {t("companyLanding.alreadyAccount")}{" "}
                    <button type="button" className="font-bold" style={{ color: primary }} onClick={() => setModal("login")}>
                      {ta("login")}
                    </button>
                  </p>
                </>
              ) : challenge ? (
                <TwoFactorForm
                  theme="light"
                  challenge={challenge}
                  onCancel={() => setChallenge(null)}
                  onVerified={(payload) => void afterAuth(payload)}
                />
              ) : (
                <>
                  <h3 className="mb-4 text-2xl font-black text-slate-950">{ta("login")}</h3>
                  <form className="space-y-3" noValidate onSubmit={onLoginSubmit}>
                    <input type="email" placeholder={ta("email")} autoComplete="email" className={creatorModalInput} value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
                    <PasswordField placeholder={ta("password")} autoComplete="current-password" inputClassName={creatorModalInput} value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
                    <button disabled={loading} type="submit" style={{ backgroundColor: button }} className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-50">
                      {loading ? ta("loggingIn") : ta("login")}
                    </button>
                    <p className="text-center text-sm text-slate-500">
                      {ta("noAccount")}{" "}
                      <button type="button" className="font-bold" style={{ color: primary }} onClick={() => setModal("creator")}>
                        {ta("signUp")}
                      </button>
                    </p>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
