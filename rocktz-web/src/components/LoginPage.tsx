"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/PasswordField";
import { RocketzLogo } from "@/components/RocketzLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CountrySelect, CurrencySelect, RegionSelect } from "@/components/GeoSelectFields";
import { alertApiError, alertWarning } from "@/lib/alerts";
import type { AuthPayload } from "@/lib/auth";
import { promptAndSendPasswordReset } from "@/lib/forgot-password";
import { getAppLocale } from "@/i18n/config";
import { laravelFetch, persistAuth, consumeAuthHash, setToken } from "@/lib/laravel";
import { attachLandingOrigin, getLandingOrigin } from "@/lib/landing-origin";
import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  defaultCurrencyForCountry,
  hasRegions,
  isValidCountry,
  isValidCurrency,
  isValidRegion,
} from "@/lib/geo";
import {
  formatCNPJ,
  formatInstagram,
  formatWhatsApp,
  instagramHandle,
  isValidCNPJ,
  isValidEmail,
  isValidWhatsApp,
  passwordError,
} from "@/lib/masks";
import { useTranslation } from "react-i18next";

type Mode = "login" | "signup";
type UserType = "creator" | "company";

export function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const ta = (key: string, opts?: Record<string, unknown>) => t(`auth:${key}`, opts);
  const tc = (key: string) => t(`common:${key}`);
  const [mode, setMode] = useState<Mode>("login");
  const [userType, setUserType] = useState<UserType>("creator");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    artistic_name: "",
    instagram: "",
    name: "",
    cnpj: "",
    email: "",
    whatsapp: "",
    city: "",
    country: DEFAULT_COUNTRY,
    state: "",
    currency: DEFAULT_CURRENCY,
    password: "",
    password_confirmation: "",
    invite_code: "",
    lgpd_accepted: false,
  });

  useEffect(() => {
    const { token } = consumeAuthHash();
    if (token) {
      setToken(token);
    }
  }, []);

  function update(key: string, value: string | boolean) {
    setForm((current) => {
      if (key === "country" && typeof value === "string") {
        const nextCurrency = defaultCurrencyForCountry(value);
        return { ...current, country: value, state: "", currency: nextCurrency };
      }
      return { ...current, [key]: value };
    });
  }

  async function submit(path: string, body: unknown) {
    setLoading(true);
    try {
      const payload = await laravelFetch<AuthPayload>(path, {
        method: "POST",
        body: JSON.stringify(
          body && typeof body === "object"
            ? { ...(body as object), locale: getAppLocale(), landing_slug: userType === "creator" ? getLandingOrigin() || undefined : undefined }
            : body,
        ),
      });
      await attachLandingOrigin(payload.user);
      router.push(persistAuth(payload, mode === "signup" && userType === "creator"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (mode === "login") {
      if (!isValidEmail(form.email) || !form.password) {
        await alertWarning(tc("alerts.incompleteTitle"), ta("loginIncomplete"));
        return;
      }
      await submit("/auth/login", { email: form.email, password: form.password });
      return;
    }

    if (userType === "creator") {
      if (!form.full_name.trim() || !form.artistic_name.trim() || instagramHandle(form.instagram).length < 2) {
        await alertWarning(tc("alerts.incompleteTitle"), ta("creatorIncomplete"));
        return;
      }
    } else if (!form.full_name.trim() || !form.name.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), ta("companySignupIncomplete"));
      return;
    }

    if (!isValidEmail(form.email)) {
      await alertWarning(tc("alerts.invalidEmailTitle"), tc("alerts.invalidEmail"));
      return;
    }
    if (!isValidWhatsApp(form.whatsapp)) {
      await alertWarning(tc("alerts.invalidWhatsappTitle"), tc("alerts.invalidWhatsapp"));
      return;
    }
    if (!form.city.trim()) {
      await alertWarning(tc("alerts.cityRequiredTitle"), ta("cityRequired"));
      return;
    }
    if (!isValidCountry(form.country)) {
      await alertWarning(tc("alerts.countryRequiredTitle"), tc("alerts.countryRequired"));
      return;
    }
    if (userType === "creator" && hasRegions(form.country) && !isValidRegion(form.country, form.state)) {
      await alertWarning(tc("alerts.regionRequiredTitle"), tc("alerts.regionRequired"));
      return;
    }
    if (userType === "company" && !isValidCurrency(form.currency)) {
      await alertWarning(tc("alerts.currencyRequiredTitle"), tc("alerts.currencyRequired"));
      return;
    }
    if (form.cnpj && !isValidCNPJ(form.cnpj)) {
      await alertWarning(ta("invalidCnpjTitle"), ta("invalidCnpj"));
      return;
    }

    const passwordIssue = passwordError(form.password, form.password_confirmation);
    if (passwordIssue) {
      await alertWarning(tc("alerts.invalidPasswordTitle"), tc(`password.${passwordIssue}`));
      return;
    }
    if (!form.lgpd_accepted) {
      await alertWarning(tc("alerts.lgpdTitle"), tc("alerts.lgpdRequired"));
      return;
    }

    if (userType === "creator") {
      await submit("/auth/register/creator", {
        full_name: form.full_name,
        artistic_name: form.artistic_name,
        instagram: instagramHandle(form.instagram),
        email: form.email,
        whatsapp: form.whatsapp,
        city: form.city,
        country: form.country,
        state: form.state,
        password: form.password,
        password_confirmation: form.password_confirmation,
        invite_code: form.invite_code.trim() || undefined,
        landing_slug: getLandingOrigin() || undefined,
        lgpd_accepted: form.lgpd_accepted,
      });
      return;
    }

    await submit("/auth/register/company", {
      name: form.name,
      responsible_name: form.full_name,
      cnpj: form.cnpj || undefined,
      email: form.email,
      whatsapp: form.whatsapp,
      city: form.city,
      country: form.country,
      currency: form.currency,
      password: form.password,
      password_confirmation: form.password_confirmation,
      lgpd_accepted: form.lgpd_accepted,
    });
  }

  async function forgotPassword() {
    await promptAndSendPasswordReset(form.email);
  }

  const fieldClass =
    "h-11 w-full rounded-xl border border-white/10 bg-[#1E293B]/40 px-4 text-sm text-white outline-none focus:border-brand-primary";

  return (
    <div data-select2-root className="flex min-h-[100dvh] items-center justify-center bg-[#0F172A] px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-2xl sm:p-8">
        <div className="mb-8 flex flex-col items-center gap-4">
          <RocketzLogo variant="dark" size="lg" href="/" />
          <LanguageSwitcher theme="dark" />
        </div>
        <div className="mb-6 flex rounded-xl bg-[#1E293B]/40 p-1">
          <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase ${mode === "login" ? "bg-brand-primary text-white" : "text-slate-400"}`}>
            {ta("doLogin")}
          </button>
          <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase ${mode === "signup" ? "bg-brand-primary text-white" : "text-slate-400"}`}>
            {ta("createAccount")}
          </button>
        </div>
        <form className="space-y-4" noValidate onSubmit={onSubmit}>
          {mode === "signup" ? (
            <>
              <div className="flex rounded-xl border border-white/5 bg-[#1E293B]/40 p-1">
                <button type="button" onClick={() => setUserType("creator")} className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase ${userType === "creator" ? "bg-indigo-600/50 text-white" : "text-slate-400"}`}>{ta("iAmCreator")}</button>
                <button type="button" onClick={() => setUserType("company")} className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase ${userType === "company" ? "bg-indigo-600/50 text-white" : "text-slate-400"}`}>{ta("iAmCompany")}</button>
              </div>
              <input className={fieldClass} placeholder={userType === "creator" ? ta("fields.fullName") : ta("fields.responsibleShort")} autoComplete="name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
              {userType === "creator" ? (
                <>
                  <input className={fieldClass} placeholder={ta("fields.artisticNameShort")} value={form.artistic_name} onChange={(e) => update("artistic_name", e.target.value)} />
                  <input className={fieldClass} placeholder={ta("fields.instagramShort")} value={form.instagram} onChange={(e) => update("instagram", formatInstagram(e.target.value))} />
                </>
              ) : (
                <>
                  <input className={fieldClass} placeholder={ta("fields.companyNameShort")} value={form.name} onChange={(e) => update("name", e.target.value)} />
                  <input className={fieldClass} placeholder={ta("fields.cnpj")} inputMode="numeric" value={form.cnpj} onChange={(e) => update("cnpj", formatCNPJ(e.target.value))} />
                </>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input className={fieldClass} placeholder={ta("fields.whatsappLong")} inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={(e) => update("whatsapp", formatWhatsApp(e.target.value))} />
                <input className={fieldClass} placeholder={ta("fields.city")} autoComplete="address-level2" value={form.city} onChange={(e) => update("city", e.target.value)} />
                <CountrySelect theme="dark" placeholder={ta("fields.country")} value={form.country} onChange={(value) => update("country", value)} />
                {userType === "creator" ? (
                  <RegionSelect theme="dark" country={form.country} placeholder={ta("fields.region")} value={form.state} onChange={(value) => update("state", value)} />
                ) : (
                  <CurrencySelect theme="dark" placeholder={ta("fields.currency")} value={form.currency} onChange={(value) => update("currency", value)} />
                )}
              </div>
            </>
          ) : null}
          <input type="email" className={fieldClass} placeholder={ta("email")} autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          <PasswordField
            placeholder={ta("password")}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            inputClassName={fieldClass}
            iconClassName="text-slate-400 hover:text-white"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
          {mode === "signup" ? (
            <>
              <PasswordField
                placeholder={ta("confirmPassword")}
                autoComplete="new-password"
                inputClassName={fieldClass}
                iconClassName="text-slate-400 hover:text-white"
                value={form.password_confirmation}
                onChange={(e) => update("password_confirmation", e.target.value)}
              />
              {userType === "creator" ? (
                <input className={`${fieldClass} uppercase`} placeholder={ta("fields.inviteCodePh")} value={form.invite_code} onChange={(e) => update("invite_code", e.target.value.toUpperCase())} />
              ) : null}
              <label className="flex items-start gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={form.lgpd_accepted} onChange={(e) => update("lgpd_accepted", e.target.checked)} />
                {ta("lgpdLogin")}
              </label>
            </>
          ) : (
            <button type="button" onClick={forgotPassword} className="text-xs font-semibold text-indigo-300 hover:text-white">
              {ta("forgotPassword")}
            </button>
          )}
          <button disabled={loading} className="w-full rounded-xl bg-brand-primary py-3 font-bold text-white">
            {loading ? ta("wait") : mode === "login" ? ta("login") : ta("createAccount")}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="text-indigo-300">{ta("backToLanding")}</Link>
        </p>
      </div>
    </div>
  );
}
