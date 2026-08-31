"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PasswordField } from "@/components/PasswordField";
import { Select2Field } from "@/components/Select2Field";
import { CountrySelect, RegionSelect } from "@/components/GeoSelectFields";
import { alertApiError, alertWarning } from "@/lib/alerts";
import type { AuthPayload } from "@/lib/auth";
import { getAppLocale } from "@/i18n/config";
import { laravelFetch } from "@/lib/laravel";
import { getLandingOrigin } from "@/lib/landing-origin";
import {
  formatInstagram,
  formatWhatsApp,
  instagramHandle,
  isValidEmail,
  isValidWhatsApp,
  passwordError,
} from "@/lib/masks";
import {
  DEFAULT_COUNTRY,
  hasRegions,
  isValidCountry,
  isValidRegion,
} from "@/lib/geo";
import { CREATOR_CATEGORY_VALUES } from "@/lib/creatorCategories";

export const creatorModalInput =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-colors focus:border-purple-600";

export function ModalField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

type Props = {
  landingSlug?: string | null;
  accentColor?: string;
  onSuccess: (payload: AuthPayload) => void;
};

export function CreatorSignupForm({ landingSlug, accentColor = "#7C3AED", onSuccess }: Props) {
  const { t } = useTranslation();
  const ta = (key: string, options?: Record<string, unknown>) => t(`auth:${key}`, options);
  const tc = (key: string, options?: Record<string, unknown>) => t(`common:${key}`, options);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [creator, setCreator] = useState({
    full_name: "",
    artistic_name: "",
    instagram: "",
    category: "UGC Content",
    whatsapp: "",
    city: "",
    country: DEFAULT_COUNTRY,
    state: "",
    email: "",
    password: "",
    password_confirmation: "",
    lgpd_accepted: false,
  });

  const categoryLabels = t("auth:categories", { returnObjects: true }) as Record<string, string>;
  const categorySelectOptions = useMemo(
    () => CREATOR_CATEGORY_VALUES.map((value) => ({ value, label: categoryLabels[value] ?? value })),
    [categoryLabels],
  );

  const buttonStyle = { backgroundColor: accentColor };

  async function goStep(next: number) {
    if (step === 1) {
      if (!creator.full_name.trim() || !creator.artistic_name.trim() || instagramHandle(creator.instagram).length < 2) {
        await alertWarning(tc("alerts.incompleteTitle"), ta("creatorIncomplete"));
        return;
      }
      if (!creator.category) {
        await alertWarning(ta("styleRequiredTitle"), ta("styleRequired"));
        return;
      }
    }
    if (step === 2) {
      if (!isValidWhatsApp(creator.whatsapp)) {
        await alertWarning(tc("alerts.invalidWhatsappTitle"), tc("alerts.invalidWhatsapp"));
        return;
      }
      if (!creator.city.trim()) {
        await alertWarning(tc("alerts.cityRequiredTitle"), tc("alerts.cityRequired"));
        return;
      }
      if (!isValidCountry(creator.country)) {
        await alertWarning(tc("alerts.countryRequiredTitle"), tc("alerts.countryRequired"));
        return;
      }
      if (hasRegions(creator.country) && !isValidRegion(creator.country, creator.state)) {
        await alertWarning(tc("alerts.regionRequiredTitle"), tc("alerts.regionRequired"));
        return;
      }
    }
    setStep(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(creator.email)) {
      await alertWarning(tc("alerts.invalidEmailTitle"), ta("invalidEmailCreate"));
      return;
    }
    const issue = passwordError(creator.password, creator.password_confirmation);
    if (issue) {
      await alertWarning(tc("alerts.invalidPasswordTitle"), tc(`password.${issue}`));
      return;
    }
    if (!creator.lgpd_accepted) {
      await alertWarning(tc("alerts.lgpdTitle"), tc("alerts.lgpdRequired"));
      return;
    }

    setLoading(true);
    try {
      const payload = await laravelFetch<AuthPayload>("/auth/register/creator", {
        method: "POST",
        body: JSON.stringify({
          ...creator,
          instagram: instagramHandle(creator.instagram),
          landing_slug: landingSlug || getLandingOrigin() || undefined,
          locale: getAppLocale(),
        }),
      });
      onSuccess(payload);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6 pr-8">
        <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[10px] font-black tracking-wider text-purple-600 uppercase">
          {ta("castingOfficial")}
        </span>
        <h3 className="mt-2 text-2xl font-black text-slate-950">{ta("wantCreatorTitle")}</h3>
        <p className="mt-1 text-xs text-slate-500">{ta("creatorStepHint", { step })}</p>
        <div className="mt-4 flex gap-2">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-purple-600" : "bg-slate-100"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-purple-600" : "bg-slate-100"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? "bg-purple-600" : "bg-slate-100"}`} />
        </div>
      </div>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        {step === 1 ? (
          <>
            <ModalField label={ta("fields.fullName")} required>
              <input placeholder={ta("fields.fullNamePh")} autoComplete="name" className={creatorModalInput} value={creator.full_name} onChange={(e) => setCreator({ ...creator, full_name: e.target.value })} />
            </ModalField>
            <ModalField label={ta("fields.artisticName")} required>
              <input placeholder={ta("fields.artisticNamePh")} className={creatorModalInput} value={creator.artistic_name} onChange={(e) => setCreator({ ...creator, artistic_name: e.target.value })} />
            </ModalField>
            <ModalField label={ta("fields.instagram")} required>
              <div className="relative">
                <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">@</span>
                <input
                  placeholder={ta("fields.instagramPh")}
                  className={`${creatorModalInput} pl-8`}
                  value={instagramHandle(creator.instagram)}
                  onChange={(e) => setCreator({ ...creator, instagram: formatInstagram(e.target.value) })}
                />
              </div>
            </ModalField>
            <ModalField label={ta("fields.style")} required>
              <Select2Field
                theme="light"
                placeholder={ta("fields.stylePh")}
                searchable
                value={creator.category}
                options={categorySelectOptions}
                onChange={(value) => setCreator({ ...creator, category: value })}
              />
            </ModalField>
            <button type="button" onClick={() => goStep(2)} style={buttonStyle} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white hover:opacity-90">
              {tc("next")} <ArrowRight size={16} />
            </button>
          </>
        ) : step === 2 ? (
          <>
            <ModalField label={ta("fields.whatsapp")} required>
              <input placeholder={ta("fields.whatsappPh")} inputMode="tel" autoComplete="tel" className={creatorModalInput} value={creator.whatsapp} onChange={(e) => setCreator({ ...creator, whatsapp: formatWhatsApp(e.target.value) })} />
            </ModalField>
            <div className="grid grid-cols-1 gap-3">
              <ModalField label={ta("fields.country")} required>
                <CountrySelect
                  theme="light"
                  placeholder={ta("fields.countryPh")}
                  value={creator.country}
                  onChange={(value) => setCreator({ ...creator, country: value, state: "" })}
                />
              </ModalField>
              <ModalField label={ta("fields.region")} required>
                <RegionSelect
                  theme="light"
                  country={creator.country}
                  placeholder={ta("fields.regionPh")}
                  value={creator.state}
                  onChange={(value) => setCreator({ ...creator, state: value })}
                />
              </ModalField>
              <ModalField label={ta("fields.city")} required>
                <input placeholder={ta("fields.cityPh")} autoComplete="address-level2" className={creatorModalInput} value={creator.city} onChange={(e) => setCreator({ ...creator, city: e.target.value })} />
              </ModalField>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)} className="w-1/3 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">{tc("back")}</button>
              <button type="button" onClick={() => goStep(3)} style={buttonStyle} className="flex w-2/3 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white hover:opacity-90">
                {tc("next")} <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <ModalField label={ta("fields.bestEmail")} required>
              <input type="email" placeholder={ta("fields.emailPh")} autoComplete="email" className={creatorModalInput} value={creator.email} onChange={(e) => setCreator({ ...creator, email: e.target.value })} />
            </ModalField>
            <ModalField label={ta("fields.createPassword")} required>
              <PasswordField placeholder={ta("minChars")} autoComplete="new-password" inputClassName={creatorModalInput} value={creator.password} onChange={(e) => setCreator({ ...creator, password: e.target.value })} />
            </ModalField>
            <ModalField label={ta("fields.confirmYourPassword")} required>
              <PasswordField placeholder={ta("repeatPassword")} autoComplete="new-password" inputClassName={creatorModalInput} value={creator.password_confirmation} onChange={(e) => setCreator({ ...creator, password_confirmation: e.target.value })} />
            </ModalField>
            <label className="flex cursor-pointer items-start gap-2.5 pt-2">
              <input type="checkbox" checked={creator.lgpd_accepted} onChange={(e) => setCreator({ ...creator, lgpd_accepted: e.target.checked })} className="mt-1 rounded text-purple-600" />
              <span className="text-[11px] leading-snug text-slate-600">{ta("lgpdCreator")}</span>
            </label>
            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={() => setStep(2)} className="w-1/3 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">{tc("back")}</button>
              <button disabled={loading} style={buttonStyle} className="w-2/3 rounded-xl py-3 text-sm font-bold text-white shadow-md disabled:opacity-50 hover:opacity-90">
                {loading ? ta("creating") : ta("finishSignup")}
              </button>
            </div>
          </>
        )}
      </form>
    </>
  );
}
