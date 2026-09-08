"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Heart, Link2, Plus, Share2, Store, Ticket, Trash2, UploadCloud } from "lucide-react";
import { AppModal } from "@/components/AppModal";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { mediaPublicUrl } from "@/lib/media-playback";
import { safeHttpUrl } from "@/lib/safe-http-url";
import type { CreatorStorefront, StorefrontItem, StorefrontItemType } from "@/lib/types";

function StorefrontImageField({
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
  const preview = mediaPublicUrl(value) || value;

  async function handleFile(file: File) {
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      await alertWarning(t("storefront.imageInvalid"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      await alertWarning(t("storefront.imageTooBig"));
      return;
    }
    setUploading(true);
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
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" referrerPolicy="no-referrer" className="h-28 w-full object-cover" />
        ) : (
          <div className="flex h-28 items-center justify-center text-xs text-slate-400">{t("storefront.noImage")}</div>
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
          {uploading ? t("storefront.uploading") : t("storefront.upload")}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
            {t("storefront.removeImage")}
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

const EMPTY_ITEM = {
  company_id: "",
  category_id: "",
  type: "link" as StorefrontItemType,
  title: "",
  description: "",
  url: "",
  coupon_code: "",
  image_url: "",
  is_published: true,
};

export function CreatorStorefrontPanel({ creatorId }: { creatorId: number }) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [data, setData] = useState<CreatorStorefront | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [slug, setSlug] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [editing, setEditing] = useState<StorefrontItem | null>(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.creatorStorefront(creatorId);
      setData(res.data);
      setSlug(res.data.eligibility.slug || res.data.slug || "");
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    void load();
  }, [creatorId]);

  const eligibility = data?.eligibility;
  const partners = data?.partners ?? [];
  const items = Array.isArray(data?.items) ? data.items : [];

  async function persistSlug() {
    const next = slug.trim().toLowerCase();
    const current = data?.eligibility.slug || data?.slug || "";
    if (!next || next === current) return;
    try {
      const res = await api.updateCreatorStorefront(creatorId, { storefront_slug: next });
      setData(res.data);
      setSlug(res.data.eligibility.slug || res.data.slug || next);
      await alertSuccess(t("storefront.slugSaved"));
    } catch (err) {
      setSlug(current);
      await alertApiError(err);
    }
  }

  async function persistBanner(url: string | null) {
    try {
      const res = await api.updateCreatorStorefront(creatorId, { storefront_banner_url: url });
      setData(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function toggleBanner(show: boolean) {
    try {
      const res = await api.updateCreatorStorefront(creatorId, { storefront_show_banner: show });
      setData(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) {
      await alertWarning(t("storefront.categoryRequired"));
      return;
    }
    try {
      await api.createStorefrontCategory(creatorId, name);
      setCategoryName("");
      await load();
      await alertSuccess(t("storefront.categoryAdded"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function removeCategory(id: number) {
    const ok = await alertConfirm(t("storefront.deleteCategoryTitle"), t("storefront.deleteCategoryBody"));
    if (!ok) return;
    try {
      await api.deleteStorefrontCategory(creatorId, id);
      await load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_ITEM, company_id: partners[0] ? String(partners[0].id) : "" });
    setItemOpen(true);
  }

  function openEdit(item: StorefrontItem) {
    setEditing(item);
    setForm({
      company_id: String(item.company_id),
      category_id: item.category_id ? String(item.category_id) : "",
      type: item.type,
      title: item.title,
      description: item.description || "",
      url: item.url,
      coupon_code: item.coupon_code || "",
      image_url: item.image_url || "",
      is_published: item.is_published,
    });
    setItemOpen(true);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!form.company_id) {
      await alertWarning(t("storefront.companyRequiredTitle"), t("storefront.companyRequired"));
      return;
    }
    if (!form.title.trim() || !form.url.trim()) {
      await alertWarning(t("storefront.itemRequiredTitle"), t("storefront.itemRequired"));
      return;
    }
    if (!safeHttpUrl(form.url)) {
      await alertWarning(t("storefront.invalidUrlTitle"), t("storefront.invalidUrl"));
      return;
    }
    if (form.type === "coupon" && !form.coupon_code.trim()) {
      await alertWarning(t("storefront.couponRequiredTitle"), t("storefront.couponRequired"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        company_id: Number(form.company_id),
        category_id: form.category_id ? Number(form.category_id) : null,
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        url: form.url.trim(),
        coupon_code: form.type === "coupon" ? form.coupon_code.trim() : null,
        image_url: form.image_url || null,
        is_published: form.is_published,
      };
      if (editing) {
        await api.updateStorefrontItem(creatorId, editing.id, body);
      } else {
        await api.createStorefrontItem(creatorId, body);
      }
      setItemOpen(false);
      await load();
      await alertSuccess(t("storefront.itemSaved"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: StorefrontItem) {
    const ok = await alertConfirm(t("storefront.deleteItemTitle"), t("storefront.deleteItemBody", { title: item.title }));
    if (!ok) return;
    try {
      await api.deleteStorefrontItem(creatorId, item.id);
      await load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function sharePage() {
    const url = eligibility?.public_url;
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("storefront.shareTitle"), url });
      } else {
        await navigator.clipboard.writeText(url);
        await alertSuccess(t("storefront.linkCopied"));
      }
    } catch {
      await navigator.clipboard.writeText(url);
      await alertSuccess(t("storefront.linkCopied"));
    }
  }

  if (!data || !eligibility) {
    return <p className="text-sm text-slate-500">{tc("loading")}</p>;
  }

  if (!eligibility.unlocked) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="mb-2 flex items-center gap-2 text-amber-800">
          <Store size={20} />
          <h3 className="text-lg font-bold">{t("storefront.lockedTitle")}</h3>
        </div>
        <p className="text-sm leading-relaxed text-amber-900/80">
          {t("storefront.lockedBody", {
            required: eligibility.required_campaigns,
            completed: eligibility.completed_campaigns,
            remaining: eligibility.remaining_campaigns,
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Store size={20} className="text-brand-primary" /> {t("storefront.title")}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{t("storefront.subtitle")}</p>
          <label className="mt-3 block">
            <span className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("storefront.slug")}</span>
            <div className="mt-1 flex gap-2">
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                onBlur={() => void persistSlug()}
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => void persistSlug()}
                className="rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                {tc("save")}
              </button>
            </div>
            <span className="mt-1 block text-[11px] font-medium text-slate-400">{t("storefront.slugHint")}</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {eligibility.public_url ? (
            <a
              href={eligibility.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink size={14} /> {t("storefront.viewPublic")}
            </a>
          ) : null}
          <button type="button" onClick={() => void sharePage()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <Share2 size={14} /> {t("storefront.sharePage")}
          </button>
          <button type="button" onClick={openCreate} disabled={partners.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400">
            <Plus size={14} /> {t("storefront.addItem")}
          </button>
        </div>
      </div>

      {partners.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">{t("storefront.noPartners")}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 text-sm font-bold text-slate-900">{t("storefront.heroTitle")}</h4>
          <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={data.show_banner}
              onChange={(event) => void toggleBanner(event.target.checked)}
            />
            <span>
              <span className="block text-xs font-bold text-slate-800">{t("storefront.showBanner")}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{t("storefront.showBannerHint")}</span>
            </span>
          </label>
          <StorefrontImageField label={t("storefront.banner")} value={eligibility.banner_url || ""} onChange={(url) => void persistBanner(url || null)} />
        </div>
        <form noValidate onSubmit={addCategory} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 text-sm font-bold text-slate-900">{t("storefront.categoriesTitle")}</h4>
          <div className="flex gap-2">
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder={t("storefront.categoryPlaceholder")}
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <button type="submit" className="rounded-xl bg-slate-900 px-3 text-xs font-bold text-white">{tc("add")}</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.categories.map((category) => (
              <span key={category.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                {category.name}
                <button type="button" onClick={() => void removeCategory(category.id)} className="text-slate-400 hover:text-rose-600" aria-label={tc("delete")}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-36 bg-slate-100">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaPublicUrl(item.image_url) || item.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">{item.type === "coupon" ? <Ticket size={32} /> : <Link2 size={32} />}</div>
              )}
              <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-700 uppercase">
                {item.type === "coupon" ? t("storefront.typeCoupon") : t("storefront.typeLink")}
              </span>
            </div>
            <div className="space-y-2 p-4">
              <p className="text-[11px] font-bold text-brand-primary">{item.company?.name}</p>
              <h5 className="text-sm font-bold text-slate-900">{item.title}</h5>
              {item.coupon_code ? <p className="rounded-lg bg-slate-50 px-2 py-1 font-mono text-xs font-bold text-slate-700">{item.coupon_code}</p> : null}
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Heart size={12} /> {item.likes_count}</span>
                <span className="inline-flex items-center gap-1"><Share2 size={12} /> {item.shares_count}</span>
                {!item.is_published ? <span className="font-bold text-amber-600">{t("storefront.draft")}</span> : null}
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => openEdit(item)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">{tc("edit")}</button>
                <button type="button" onClick={() => void removeItem(item)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">{tc("delete")}</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {itemOpen ? (
        <AppModal onClose={() => setItemOpen(false)}>
          <form noValidate onSubmit={saveItem} className="flex min-h-0 flex-col">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-black text-slate-900">{editing ? t("storefront.editItem") : t("storefront.addItem")}</h3>
            </div>
            <div className="space-y-3 overflow-y-auto px-5 py-4">
              <Select2Field
                theme="light"
                placeholder={t("storefront.company")}
                value={form.company_id}
                options={partners.map((company) => ({ value: String(company.id), label: company.name }))}
                onChange={(value) => setForm((current) => ({ ...current, company_id: value }))}
              />
              <Select2Field
                theme="light"
                placeholder={t("storefront.type")}
                value={form.type}
                options={[
                  { value: "link", label: t("storefront.typeLink") },
                  { value: "coupon", label: t("storefront.typeCoupon") },
                ]}
                onChange={(value) => setForm((current) => ({ ...current, type: value as StorefrontItemType }))}
              />
              <Select2Field
                theme="light"
                placeholder={t("storefront.category")}
                value={form.category_id}
                options={[{ value: "", label: t("storefront.noCategory") }, ...data.categories.map((category) => ({ value: String(category.id), label: category.name }))]}
                onChange={(value) => setForm((current) => ({ ...current, category_id: value }))}
              />
              <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder={t("storefront.itemTitle")} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
              <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder={t("storefront.itemUrl")} value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} />
              {form.type === "coupon" ? (
                <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-mono" placeholder={t("storefront.couponCode")} value={form.coupon_code} onChange={(event) => setForm((current) => ({ ...current, coupon_code: event.target.value }))} />
              ) : null}
              <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("storefront.itemDescription")} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              <StorefrontImageField label={t("storefront.itemImage")} value={form.image_url} onChange={(url) => setForm((current) => ({ ...current, image_url: url }))} />
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600" checked={form.is_published} onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))} />
                {t("storefront.publishItem")}
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setItemOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">{tc("cancel")}</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? tc("saving") : tc("save")}</button>
            </div>
          </form>
        </AppModal>
      ) : null}
    </div>
  );
}
