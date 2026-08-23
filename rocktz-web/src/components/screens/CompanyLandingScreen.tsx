"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, Eye, Globe, QrCode, Share2, UploadCloud } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { CompanyPublicLanding } from "@/components/CompanyPublicLanding";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { companyLandingPath } from "@/lib/landing-origin";
import { mediaPublicUrl } from "@/lib/media-playback";
import type { CompanyLandingPage } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-brand-primary";

function LandingImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const { t } = useTranslation("app");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState(false);
  const preview = mediaPublicUrl(value) || value;

  useEffect(() => {
    setBroken(false);
  }, [preview]);

  async function handleFile(file: File) {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      await alertWarning(t("companyLanding.imageInvalid"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      await alertWarning(t("companyLanding.imageTooBig"));
      return;
    }
    setUploading(true);
    setBroken(false);
    try {
      const uploaded = await api.uploadMedia(file, file.name);
      onChange(uploaded.data.url);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">{label}</label>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {value && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-32 w-full object-cover" />
        ) : (
          <div className="flex h-32 items-center justify-center px-3 text-center text-xs text-slate-400">
            {value ? t("companyLanding.imageBroken") : t("companyLanding.noImage")}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <UploadCloud size={14} />
          {uploading ? t("companyLanding.uploading") : t("companyLanding.upload")}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
            {t("companyLanding.removeImage")}
          </button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function CompanyLandingInner() {
  const user = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation("app");
  const isAdmin = user.role === "admin";
  const queryCompanyId = Number(searchParams.get("companyId") || 0);
  const companyId = isAdmin ? queryCompanyId || 0 : (user.company?.id ?? 0);

  const [page, setPage] = useState<CompanyLandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    display_name: "",
    logo_url: "",
    banner_url: "",
    title: "",
    description: "",
    cta_text: "",
    primary_color: "#8A3FFC",
    button_color: "#8A3FFC",
    background_color: "#FDFDFE",
    website_url: "",
    instagram: "",
    tiktok: "",
    youtube: "",
    linkedin: "",
  });
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (isAdmin && !companyId) {
      api.companies().then((res) => {
        const first = res.data[0];
        if (first) router.replace(`/company-landing?companyId=${first.id}`);
      }).catch(alertApiError).finally(() => setLoading(false));
      return;
    }
    if (!companyId) {
      setLoading(false);
      return;
    }
    api.companyLanding(companyId)
      .then((res) => {
        setPage(res.data);
        hydrate(res.data);
      })
      .catch(alertApiError)
      .finally(() => setLoading(false));
  }, [companyId, isAdmin, router]);

  function hydrate(data: CompanyLandingPage) {
    setForm({
      slug: data.slug || "",
      display_name: data.display_name || "",
      logo_url: data.logo_url || "",
      banner_url: data.banner_url || "",
      title: data.title || "",
      description: data.description || "",
      cta_text: data.cta_text || "",
      primary_color: data.primary_color || "#8A3FFC",
      button_color: data.button_color || "#8A3FFC",
      background_color: data.background_color || "#FDFDFE",
      website_url: data.website_url || "",
      instagram: data.socials?.instagram || "",
      tiktok: data.socials?.tiktok || "",
      youtube: data.socials?.youtube || "",
      linkedin: data.socials?.linkedin || "",
    });
  }

  async function persistImage(field: "logo_url" | "banner_url", url: string) {
    setForm((current) => ({ ...current, [field]: url }));
    if (!companyId) return;
    try {
      const res = await api.updateCompanyLanding(companyId, { [field]: url || null });
      setPage(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined" || !form.slug) return "";
    return `${window.location.origin}${companyLandingPath(form.slug)}`;
  }, [form.slug]);

  const metrics = page?.metrics;

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!companyId) return false;
    const current = formRef.current;
    setSaving(true);
    try {
      const res = await api.updateCompanyLanding(companyId, {
        slug: current.slug,
        display_name: current.display_name,
        logo_url: current.logo_url || null,
        banner_url: current.banner_url || null,
        title: current.title || null,
        description: current.description || null,
        cta_text: current.cta_text || null,
        primary_color: current.primary_color,
        button_color: current.button_color,
        background_color: current.background_color,
        website_url: current.website_url || null,
        socials: {
          instagram: current.instagram,
          tiktok: current.tiktok,
          youtube: current.youtube,
          linkedin: current.linkedin,
        },
      });
      setPage(res.data);
      hydrate(res.data);
      await alertSuccess(t("companyLanding.saved"));
      return true;
    } catch (err) {
      await alertApiError(err);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!companyId) return;
    if (!(await save())) return;
    try {
      const res = await api.publishCompanyLanding(companyId);
      setPage(res.data);
      await alertSuccess(t("companyLanding.published"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function disable() {
    if (!companyId) return;
    try {
      const res = await api.disableCompanyLanding(companyId);
      setPage(res.data);
      await alertSuccess(t("companyLanding.disabled"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      await alertSuccess(t("companyLanding.linkCopied"));
    } catch {
      await alertWarning(t("companyLanding.copyFail"));
    }
  }

  async function shareLink() {
    if (!publicUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: form.display_name, url: publicUrl });
        return;
      } catch {
        /* user cancelled or share failed — fall back to copy */
      }
    }
    await copyLink();
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">{t("companyLanding.loading")}</div>;
  }

  if (!companyId || !page) {
    return <p className="text-sm text-slate-500">{t("companyDash.noCompany")}</p>;
  }

  if (preview) {
    return (
      <div className="-m-3 sm:-m-6 lg:-m-10">
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
          <p className="text-xs font-bold uppercase tracking-wider">{t("companyLanding.previewTitle")}</p>
          <button type="button" onClick={() => setPreview(false)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-950">
            {t("companyLanding.closePreview")}
          </button>
        </div>
        <CompanyPublicLanding page={{ ...page, ...form, socials: { instagram: form.instagram, tiktok: form.tiktok, youtube: form.youtube, linkedin: form.linkedin } }} preview />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("companyLanding.title")}
        subtitle={t("companyLanding.subtitle")}
        actions={
          <>
            <Link href={`/company-landing/signups${isAdmin ? `?companyId=${companyId}` : ""}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700">
              {t("companyLanding.viewSignups")}
            </Link>
            <button type="button" onClick={() => setPreview(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700">
              <Eye size={14} /> {t("companyLanding.preview")}
            </button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={page.status} />
        {page.status === "published" ? (
          <button type="button" onClick={() => void disable()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
            {t("companyLanding.disable")}
          </button>
        ) : (
          <button type="button" onClick={() => void publish()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">
            {t("companyLanding.publish")}
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("companyLanding.metrics.views")} value={metrics?.views ?? 0} />
        <StatCard label={t("companyLanding.metrics.signups")} value={metrics?.signups_completed ?? 0} />
        <StatCard label={t("companyLanding.metrics.analyzed")} value={metrics?.analyzed ?? 0} />
        <StatCard label={t("companyLanding.metrics.approved")} value={metrics?.approved ?? 0} />
      </div>
      <p className="mb-6 text-xs text-slate-500">
        {t("companyLanding.metrics.conversion", { rate: metrics?.conversion_rate ?? 0 })}
      </p>

      <form noValidate onSubmit={(e) => void save(e)} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-700">
              {t("companyLanding.fields.displayName")}
              <input className={`${fieldClass} mt-1`} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              {t("companyLanding.fields.slug")}
              <input className={`${fieldClass} mt-1`} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
              <span className="mt-1 block text-[11px] font-medium text-slate-400">{t("companyLanding.fields.slugHint")}</span>
            </label>
          </div>
          <label className="block text-xs font-bold text-slate-700">
            {t("companyLanding.fields.title")}
            <input className={`${fieldClass} mt-1`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("companyLanding.fields.titlePh", { name: form.display_name || "..." })} />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            {t("companyLanding.fields.description")}
            <textarea className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-primary" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            {t("companyLanding.fields.cta")}
            <input className={`${fieldClass} mt-1`} value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <LandingImageField label={t("companyLanding.fields.logo")} value={form.logo_url} onChange={(url) => void persistImage("logo_url", url)} />
            <LandingImageField label={t("companyLanding.fields.banner")} value={form.banner_url} onChange={(url) => void persistImage("banner_url", url)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["primary_color", "button_color", "background_color"] as const).map((key) => (
              <label key={key} className="block text-xs font-bold text-slate-700">
                {t(`companyLanding.fields.${key}`)}
                <input type="color" className="mt-1 h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
          </div>
          <label className="block text-xs font-bold text-slate-700">
            {t("companyLanding.fields.website")}
            <input className={`${fieldClass} mt-1`} value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={fieldClass} placeholder="Instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
            <input className={fieldClass} placeholder="TikTok" value={form.tiktok} onChange={(e) => setForm({ ...form, tiktok: e.target.value })} />
            <input className={fieldClass} placeholder="YouTube" value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} />
            <input className={fieldClass} placeholder="LinkedIn" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
          </div>
          <button disabled={saving} className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            {saving ? t("companyLanding.saving") : t("companyLanding.save")}
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black tracking-wider text-slate-900 uppercase">{t("companyLanding.shareTitle")}</p>
            <p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{publicUrl || "—"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void copyLink()} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700">
                <Copy size={13} /> {t("companyLanding.copyLink")}
              </button>
              <a href={publicUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700">
                <ExternalLink size={13} /> {t("companyLanding.openPage")}
              </a>
              <button type="button" onClick={() => void shareLink()} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700">
                <Share2 size={13} /> {t("companyLanding.share")}
              </button>
              <button type="button" onClick={() => setShowQr((value) => !value)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700">
                <QrCode size={13} /> QR Code
              </button>
            </div>
            {showQr && publicUrl ? (
              <div className="mt-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`}
                  alt=""
                  width={200}
                  height={200}
                  className="rounded-xl border border-slate-200 bg-white p-2"
                />
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-950">
            <Globe size={16} className="mb-2 text-indigo-600" />
            <p className="font-bold">{t("companyLanding.hintTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-indigo-800">{t("companyLanding.hintBody")}</p>
          </div>
        </div>
      </form>
    </div>
  );
}

export function CompanyLandingScreen() {
  return (
    <AuthenticatedShell>
      <Suspense fallback={<div className="flex h-64 items-center justify-center text-sm text-slate-500">...</div>}>
        <CompanyLandingInner />
      </Suspense>
    </AuthenticatedShell>
  );
}
