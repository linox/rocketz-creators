"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Heart, Link2, Share2, Ticket } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { RocketzLogo } from "@/components/RocketzLogo";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess } from "@/lib/alerts";
import { mediaPublicUrl } from "@/lib/media-playback";
import { safeHttpUrl } from "@/lib/safe-http-url";
import type { CreatorStorefront, StorefrontItem } from "@/lib/types";

export function CreatorPublicStorefront({ page }: { page: CreatorStorefront }) {
  const { t } = useTranslation("app");
  const [items, setItems] = useState(page.items ?? []);
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const creator = page.creator;
  const storefrontKey = page.slug || page.eligibility.slug || String(creator.id);
  const banner = page.show_banner ? mediaPublicUrl(page.banner_url) || page.banner_url : null;
  const publicUrl = page.seo?.url || page.eligibility.public_url || (typeof window !== "undefined" ? window.location.href : "");

  const visible = useMemo(
    () => items.filter((item) => categoryId === "all" || item.category_id === categoryId),
    [items, categoryId],
  );

  async function likeItem(item: StorefrontItem) {
    try {
      const res = await api.likeStorefrontItem(storefrontKey, item.id);
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, liked: res.liked, likes_count: res.likes_count } : row)));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function shareItem(item: StorefrontItem) {
    const url = safeHttpUrl(item.url) || publicUrl;
    try {
      await api.shareStorefrontItem(storefrontKey, item.id);
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, shares_count: row.shares_count + 1 } : row)));
      if (navigator.share) {
        await navigator.share({ title: item.title, text: item.description || undefined, url });
      } else {
        await navigator.clipboard.writeText(url);
        await alertSuccess(t("storefront.linkCopied"));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        await alertSuccess(t("storefront.linkCopied"));
      } catch {
        await alertApiError(err);
      }
    }
  }

  async function sharePage() {
    try {
      if (navigator.share) {
        await navigator.share({ title: page.seo?.title || creator.artistic_name, url: publicUrl });
      } else {
        await navigator.clipboard.writeText(publicUrl);
        await alertSuccess(t("storefront.linkCopied"));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      await navigator.clipboard.writeText(publicUrl);
      await alertSuccess(t("storefront.linkCopied"));
    }
  }

  async function copyCoupon(code: string) {
    await navigator.clipboard.writeText(code);
    await alertSuccess(t("storefront.couponCopied"));
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="flex items-center justify-between px-4 py-3 sm:px-8">
        <RocketzLogo variant="light" size="sm" href="/" showSubtitle={false} />
        <LanguageSwitcher theme="light" layout="menu" />
      </header>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200/80">
          {banner ? (
            <div className="h-44 w-full sm:h-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banner} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-28 bg-gradient-to-r from-[#8A3FFC] to-indigo-500 sm:h-36" />
          )}
          <div className="relative px-5 pb-8 sm:px-8">
            <div className="-mt-12 mb-4 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-3">
                <UserAvatar src={creator.photo_url} name={creator.artistic_name} size="custom" shape="rounded-2xl" className="h-24 w-24 border-4 border-white shadow-md sm:h-28 sm:w-28" textClassName="text-3xl font-bold" />
                <div className="pb-1">
                  <p className="text-[11px] font-black tracking-widest text-brand-primary uppercase">{t("storefront.publicKicker")}</p>
                  <h1 className="text-2xl font-black text-slate-950">@{creator.artistic_name}</h1>
                  {creator.city ? <p className="text-xs text-slate-500">{[creator.city, creator.state].filter(Boolean).join(" · ")}</p> : null}
                </div>
              </div>
              <button type="button" onClick={() => void sharePage()} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-600">
                <Share2 size={14} /> {t("storefront.sharePage")}
              </button>
            </div>
            {creator.bio ? <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{creator.bio}</p> : null}
          </div>
        </div>

        {page.categories.length > 0 ? (
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setCategoryId("all")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${categoryId === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
              {t("storefront.allCategories")}
            </button>
            {page.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap ${categoryId === category.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const href = safeHttpUrl(item.url);
            return (
              <article key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
                <div className="relative h-40 bg-slate-100">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaPublicUrl(item.image_url) || item.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">{item.type === "coupon" ? <Ticket size={36} /> : <Link2 size={36} />}</div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-brand-primary">{item.company?.name}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase">
                      {item.type === "coupon" ? t("storefront.typeCoupon") : t("storefront.typeLink")}
                    </span>
                  </div>
                  <h2 className="text-base font-black text-slate-950">{item.title}</h2>
                  {item.description ? <p className="text-xs leading-relaxed text-slate-500">{item.description}</p> : null}
                  {item.coupon_code ? (
                    <button type="button" onClick={() => void copyCoupon(item.coupon_code || "")} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-800 hover:bg-slate-100">
                      {item.coupon_code}
                      <Copy size={14} className="text-slate-400" />
                    </button>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void likeItem(item)}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${item.liked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      <Heart size={14} className={item.liked ? "fill-current" : ""} /> {item.likes_count}
                    </button>
                    <button type="button" onClick={() => void shareItem(item)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                      <Share2 size={14} /> {t("storefront.shareItem")}
                    </button>
                  </div>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center rounded-xl bg-brand-primary text-xs font-bold tracking-wider text-white uppercase hover:bg-indigo-600">
                      {item.type === "coupon" ? t("storefront.useCoupon") : t("storefront.openLink")}
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500">{t("storefront.emptyPublic")}</p>
        ) : null}
      </div>
    </div>
  );
}
