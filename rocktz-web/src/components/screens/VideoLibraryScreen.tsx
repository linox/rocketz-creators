"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Clapperboard, ExternalLink, History, Megaphone, Play, Search, X } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { VideoLightbox } from "@/components/VideoLightbox";
import { VideoPoster } from "@/components/VideoPoster";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { safeHttpUrl } from "@/lib/safe-http-url";
import type { CreatorVideo, CreatorVideoStatus, CreatorVideoUsageKind } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type UsageFilter = "all" | "unused" | "posted" | "ad";

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-500";

function creatorIdentity(creator: CreatorVideo["creator"]) {
  const handle = (creator.artistic_name || "").replace(/^@+/, "").trim();
  const name = (creator.full_name || "").trim();
  const same = Boolean(handle && name && handle.localeCompare(name, undefined, { sensitivity: "base" }) === 0);
  return {
    name: name || (handle ? `@${handle}` : "—"),
    handle: handle && name && !same ? `@${handle}` : "",
  };
}

function formatWhen(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesFilter(video: CreatorVideo, filter: UsageFilter) {
  if (filter === "unused") return video.status === "unused";
  if (filter === "posted") return video.status === "posted" || video.status === "posted_and_ad";
  if (filter === "ad") return video.status === "ad" || video.status === "posted_and_ad";
  return true;
}

function badgeKeys(status: CreatorVideoStatus): Array<"unused" | "posted" | "ad"> {
  if (status === "posted_and_ad") return ["posted", "ad"];
  if (status === "posted" || status === "ad") return [status];
  return ["unused"];
}

function badgeTone(kind: "unused" | "posted" | "ad") {
  if (kind === "posted") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (kind === "ad") return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function VideoLibraryScreen() {
  return (
    <AuthenticatedShell>
      <VideoLibraryInner />
    </AuthenticatedShell>
  );
}

function VideoLibraryInner() {
  const { t, i18n } = useTranslation("app");
  const user = useAuth();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const [videos, setVideos] = useState<CreatorVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UsageFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [kind, setKind] = useState<CreatorVideoUsageKind>("posted");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.creatorVideos()
      .then((response) => {
        if (!cancelled) setVideos(response.data);
      })
      .catch((error) => {
        if (!cancelled) void alertApiError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searched = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return videos;
    return videos.filter((video) => {
      const identity = creatorIdentity(video.creator);
      return [video.title, video.format, video.campaign_name, video.contract_name, video.company_name, identity.name, identity.handle]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [search, videos]);

  const visible = useMemo(() => searched.filter((video) => matchesFilter(video, filter)), [filter, searched]);
  const selected = videos.find((video) => video.id === selectedId) ?? null;
  const counts = {
    total: searched.length,
    unused: searched.filter((video) => video.status === "unused").length,
    posted: searched.filter((video) => video.status === "posted" || video.status === "posted_and_ad").length,
    ad: searched.filter((video) => video.status === "ad" || video.status === "posted_and_ad").length,
  };

  const filterOptions = useMemo(() => [
    { value: "all", label: t("videoLibrary.filterAll") },
    { value: "unused", label: t("videoLibrary.filterUnused") },
    { value: "posted", label: t("videoLibrary.filterPosted") },
    { value: "ad", label: t("videoLibrary.filterAd") },
  ], [t]);

  const kindOptions = useMemo(() => [
    { value: "posted", label: t("videoLibrary.kindPosted") },
    { value: "ad", label: t("videoLibrary.kindAd") },
  ], [t]);

  function replaceVideo(next: CreatorVideo) {
    setVideos((current) => current.map((video) => (video.id === next.id ? next : video)));
  }

  async function registerUsage(event: FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    const link = url.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      await alertWarning(t("videoLibrary.invalidUrlTitle"), t("videoLibrary.invalidUrl"));
      return;
    }
    setSaving(true);
    try {
      const response = await api.addCreatorVideoUsage(selected.id, {
        kind,
        url: link || null,
        note: note.trim() || null,
        occurred_at: when || null,
      });
      replaceVideo(response.data);
      setUrl("");
      setNote("");
      setWhen("");
      await alertSuccess(t("videoLibrary.saved"));
    } catch (error) {
      await alertApiError(error);
    } finally {
      setSaving(false);
    }
  }

  async function removeUsage(usageId: number) {
    if (!selected) return;
    const confirmed = await alertConfirm(t("videoLibrary.removeTitle"), t("videoLibrary.removeText"), t("videoLibrary.remove"));
    if (!confirmed) return;
    try {
      const response = await api.removeCreatorVideoUsage(selected.id, usageId);
      replaceVideo(response.data);
      await alertSuccess(t("videoLibrary.removed"));
    } catch (error) {
      await alertApiError(error);
    }
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{t("videoLibrary.title")}</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            {user.role === "creator" ? t("videoLibrary.subtitleCreator") : t("videoLibrary.subtitle")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("videoLibrary.search")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-violet-500"
            />
          </label>
          <Select2Field
            theme="light"
            value={filter}
            options={filterOptions}
            onChange={(value) => setFilter((value || "all") as UsageFilter)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["all", counts.total, "border-slate-200 bg-white text-slate-800"],
            ["unused", counts.unused, "border-slate-200 bg-slate-50 text-slate-700"],
            ["posted", counts.posted, "border-emerald-200 bg-emerald-50 text-emerald-800"],
            ["ad", counts.ad, "border-violet-200 bg-violet-50 text-violet-800"],
          ] as const).map(([key, count, tone]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn("rounded-2xl border px-3 py-3 text-left", tone, filter === key && "ring-2 ring-violet-500")}
            >
              <span className="block text-xl font-black">{count}</span>
              <span className="text-xs font-bold">{t(`videoLibrary.summary.${key}`)}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">{t("common:loading")}</p>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <Clapperboard className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              {videos.length === 0 ? t("videoLibrary.empty") : t("videoLibrary.emptyFilter")}
            </p>
          </div>
        ) : (
          <div className={cn("grid items-start gap-4", selected && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {visible.map((video) => {
                const identity = creatorIdentity(video.creator);
                const active = video.id === selectedId;
                const src = video.video_url;
                return (
                  <li key={video.id}>
                    <article className={cn("overflow-hidden rounded-3xl border bg-white shadow-sm", active ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200")}>
                      <div className="relative aspect-video bg-slate-900">
                        {src ? <VideoPoster src={src} lite /> : null}
                        {src ? (
                          <button
                            type="button"
                            onClick={() => setPlaying(src)}
                            aria-label={t("videoLibrary.watch")}
                            className="absolute inset-0 z-10"
                          >
                            <span className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-900">
                              <Play size={14} />
                            </span>
                          </button>
                        ) : null}
                        <span className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap gap-1">
                          {badgeKeys(video.status).map((badge) => (
                            <span key={badge} className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", badgeTone(badge))}>
                              {t(`videoLibrary.badge.${badge}`)}
                            </span>
                          ))}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(video.id)}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left"
                      >
                        <UserAvatar src={video.creator.photo_url} name={identity.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">{identity.name}</span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {[identity.handle, video.campaign_name || video.contract_name, video.title].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <History size={16} className="shrink-0 text-slate-400" />
                      </button>
                    </article>
                  </li>
                );
              })}
            </ul>

            {selected ? (
              <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{creatorIdentity(selected.creator).name}</p>
                    <p className="truncate text-xs text-slate-500">{selected.title}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label={t("videoLibrary.close")}>
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.video_url ? (
                    <button type="button" onClick={() => setPlaying(selected.video_url)} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
                      <Play size={12} /> {t("videoLibrary.watch")}
                    </button>
                  ) : null}
                  {selected.campaign_id ? (
                    <Link href={`/campaigns/${selected.campaign_id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">
                      <Megaphone size={12} /> {selected.campaign_name}
                    </Link>
                  ) : null}
                  {selected.recurring_contract_id ? (
                    <Link href={`/recurring/${selected.recurring_contract_id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">
                      {selected.contract_name}
                    </Link>
                  ) : null}
                </div>

                <p className="mt-3 text-[11px] text-slate-400">
                  {[
                    selected.received_at ? t("videoLibrary.receivedAt", { date: formatWhen(selected.received_at, locale) }) : "",
                    formatSize(selected.video_file_size),
                    user.role === "admin" ? selected.company_name : "",
                    selected.source === "recurring" ? t("videoLibrary.fromRecurring") : t("videoLibrary.fromCampaign"),
                  ].filter(Boolean).join(" · ")}
                </p>

                <h2 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">{t("videoLibrary.history")}</h2>
                {selected.usages.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">{t("videoLibrary.historyEmpty")}</p>
                ) : (
                  <ol className="mt-3 space-y-3">
                    {selected.usages.map((usage) => {
                      const href = safeHttpUrl(usage.url || "");
                      return (
                        <li key={usage.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", badgeTone(usage.kind))}>
                              {t(`videoLibrary.badge.${usage.kind}`)}
                            </span>
                            {selected.can_manage ? (
                              <button type="button" onClick={() => void removeUsage(usage.id)} className="text-[11px] font-bold text-rose-600">
                                {t("videoLibrary.remove")}
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatWhen(usage.occurred_at, locale)}
                            {" · "}
                            {usage.source === "auto" ? t("videoLibrary.sourceAuto") : usage.recorded_by || t("videoLibrary.sourceManual")}
                          </p>
                          {usage.note ? <p className="mt-1 text-sm text-slate-700">{usage.note}</p> : null}
                          {href ? (
                            <a href={href} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline">
                              {t("videoLibrary.openLink")} <ExternalLink size={12} />
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}

                {selected.can_manage ? (
                  <form noValidate onSubmit={(event) => void registerUsage(event)} className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                    <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">{t("videoLibrary.addTitle")}</h2>
                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                      {t("videoLibrary.kind")}
                      <Select2Field theme="light" value={kind} options={kindOptions} onChange={(value) => setKind(value === "ad" ? "ad" : "posted")} />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                      {t("videoLibrary.url")}
                      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={t("videoLibrary.urlPlaceholder")} className={fieldClass} inputMode="url" />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                      {t("videoLibrary.note")}
                      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("videoLibrary.notePlaceholder")} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-500" />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                      {t("videoLibrary.when")}
                      <input type="date" value={when} onChange={(event) => setWhen(event.target.value)} className={fieldClass} />
                    </label>
                    <button type="submit" disabled={saving} className="h-11 w-full rounded-xl bg-violet-600 text-sm font-bold text-white disabled:opacity-60">
                      {t("videoLibrary.save")}
                    </button>
                  </form>
                ) : null}
              </aside>
            ) : null}
          </div>
        )}
      </div>
      {playing ? <VideoLightbox src={playing} onClose={() => setPlaying(null)} /> : null}
    </>
  );
}
