"use client";

import { FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Eye, Play, RectangleHorizontal, RectangleVertical, Trash2, UploadCloud, Video, X } from "lucide-react";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { VideoPlayer } from "@/components/VideoPlayer";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { isUploadCancelled } from "@/lib/laravel";
import type { Creator } from "@/lib/types";

const PLAYER_MAX_BYTES = 200 * 1024 * 1024;

type PortfolioVideo = NonNullable<Creator["portfolio"]>[number];

function isPlayable(video: PortfolioVideo) {
  return !video.file_size || video.file_size <= PLAYER_MAX_BYTES;
}

function downloadHref(video: PortfolioVideo) {
  return video.download_url || video.url;
}

function formatMb(bytes?: number) {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeUploadName(file: File) {
  const raw = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ext = ["mp4", "mov", "webm", "mkv", "avi", "m4v"].includes(raw) ? raw : "mp4";
  return `portfolio.${ext}`;
}

function detectOrientation(file: File): Promise<"horizontal" | "vertical"> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.videoWidth >= video.videoHeight ? "horizontal" : "vertical");
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("vertical");
    };
    video.src = url;
  });
}

export function CreatorPortfolioPanel({
  creator,
  canUpload,
  onChanged,
}: {
  creator: Creator;
  canUpload: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playVideo, setPlayVideo] = useState<PortfolioVideo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const videos = creator.portfolio ?? [];
  const vertical = videos.filter((video) => video.orientation !== "horizontal");
  const horizontal = videos.filter((video) => video.orientation === "horizontal");

  function pickFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      void alertWarning(t("invalidVideoTitle"), t("invalidVideo"));
      return;
    }
    setUploadFile(file);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!uploadFile || !title.trim()) {
      await alertWarning(t("videoRequiredTitle"), t("videoRequired"));
      return;
    }
    setUploading(true);
    setProgress(0);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const orientation = await detectOrientation(uploadFile);
      const uploaded = await api.uploadMedia(uploadFile, safeUploadName(uploadFile), setProgress, abort.signal);
      setProgress(100);
      await api.addPortfolio(creator.id, {
        title: title.trim(),
        url: uploaded.data.url,
        description: description.trim() || null,
        orientation,
        file_size: uploaded.data.size ?? uploadFile.size,
      });
      await alertSuccess(t("videoSaved"));
      setUploadFile(null);
      setTitle("");
      setDescription("");
      onChanged();
    } catch (err) {
      if (!isUploadCancelled(err)) {
        await alertApiError(err);
      }
    } finally {
      abortRef.current = null;
      setUploading(false);
      setProgress(0);
    }
  }

  function cancelUpload() {
    abortRef.current?.abort();
  }

  async function onRemove(video: PortfolioVideo) {
    if (!(await alertConfirm(t("removeVideoTitle"), t("removeVideoText", { title: video.title })))) return;
    try {
      await api.removePortfolio(creator.id, video.id);
      await alertSuccess(t("videoRemoved"));
      onChanged();
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {canUpload ? (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6 rounded-[16px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
          <div>
            <h3 className="flex items-center gap-2 text-[18px] font-bold text-[#0F172A]">
              <UploadCloud size={20} className="text-brand-primary" /> {t("uploadTitle")}
            </h3>
            <p className="mt-1 text-[12px] text-[#64748B]">{t("uploadHint")}</p>
          </div>
          <div
            onDragEnter={(e) => { e.preventDefault(); if (!uploading) setDragActive(true); }}
            onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (!uploading) pickFile(e.dataTransfer.files?.[0]); }}
            onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed p-6 text-center transition-all",
              uploading ? "cursor-not-allowed opacity-70" : "cursor-pointer",
              dragActive ? "border-brand-primary bg-indigo-50/25" : "border-[#E2E8F0] hover:border-brand-primary",
              uploadFile ? "border-emerald-300 bg-emerald-50/10" : "",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi,video/*,.mp4,.mov,.webm,.mkv,.avi"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
            />
            <div className={cn("rounded-xl bg-slate-50 p-3 text-slate-400", uploadFile && "bg-emerald-100/50 text-emerald-600")}>
              <Video size={24} />
            </div>
            {uploadFile ? (
              <div>
                <span className="text-sm font-bold text-emerald-700">{t("fileSelected")}</span>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{uploadFile.name} ({formatMb(uploadFile.size)})</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#0F172A]">{t("dropLabel")}</span>
                <span className="text-[10px] tracking-wider text-[#64748B] uppercase">{t("dropFormats")}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaignTitle")}</span>
              <input className="h-11 w-full rounded-lg border border-[#E2E8F0] px-4 text-sm outline-none focus:border-brand-primary" placeholder={t("campaignTitlePh")} value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaignDesc")}</span>
              <input className="h-11 w-full rounded-lg border border-[#E2E8F0] px-4 text-sm outline-none focus:border-brand-primary" placeholder={t("campaignDescPh")} value={description} onChange={(e) => setDescription(e.target.value)} disabled={uploading} />
            </label>
          </div>
          {uploading ? (
            <div className="flex flex-col gap-3">
              <UploadProgressBar progress={progress} />
              <button
                type="button"
                onClick={cancelUpload}
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-rose-600 text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-rose-100 hover:bg-rose-700"
              >
                <X size={16} /> {t("cancelUpload")}
              </button>
            </div>
          ) : (
            <button type="submit" disabled={!uploadFile || !title.trim()} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-indigo-100 hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none">
              <UploadCloud size={16} /> {t("sendVideo")}
            </button>
          )}
        </form>
      ) : null}

      <div className="flex flex-col gap-6 rounded-[16px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
        <div>
          <h3 className="flex items-center gap-2 text-[18px] font-bold text-[#0F172A]">
            <Video size={20} className="text-brand-primary" /> {t("portfolioCount", { count: videos.length })}
          </h3>
          <p className="mt-1 text-[12px] text-[#64748B]">{t("portfolioWatchHint")}</p>
        </div>
        {!videos.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#E2E8F0] p-12 text-center">
            <div className="rounded-full bg-slate-50 p-3 text-slate-400"><Play size={24} /></div>
            <h4 className="text-sm font-bold text-slate-800">{t("emptyPortfolio")}</h4>
            <p className="max-w-sm text-xs leading-relaxed text-[#64748B]">{canUpload ? t("emptyPortfolioCreator") : t("emptyPortfolioAgency")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <OrientationGrid
              title={t("vertical")}
              icon={RectangleVertical}
              videos={vertical}
              empty={t("emptyVertical")}
              canUpload={canUpload}
              onPlay={setPlayVideo}
              onRemove={onRemove}
            />
            <OrientationGrid
              title={t("horizontal")}
              icon={RectangleHorizontal}
              videos={horizontal}
              empty={t("emptyHorizontal")}
              canUpload={canUpload}
              onPlay={setPlayVideo}
              onRemove={onRemove}
            />
          </div>
        )}
      </div>

      {playVideo && isPlayable(playVideo) ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4">
          <button type="button" className="absolute inset-0" aria-label={t("closePlayer")} onClick={() => setPlayVideo(null)} />
          <div className={cn("relative z-10 overflow-hidden rounded-2xl bg-black shadow-2xl", playVideo.orientation === "horizontal" ? "w-full max-w-4xl" : "w-full max-w-md")}>
            <VideoPlayer src={playVideo.url} autoPlay className="max-h-[80vh] w-full" />
            <button type="button" onClick={() => setPlayVideo(null)} className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold">{t("closePlayer")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrientationGrid({
  title,
  icon: Icon,
  videos,
  empty,
  canUpload,
  onPlay,
  onRemove,
}: {
  title: string;
  icon: typeof RectangleVertical;
  videos: PortfolioVideo[];
  empty: string;
  canUpload: boolean;
  onPlay: (video: PortfolioVideo) => void;
  onRemove: (video: PortfolioVideo) => void;
}) {
  const { t } = useTranslation("profile");
  return (
    <section className="flex flex-col gap-4">
      <h4 className="flex items-center gap-2 text-sm font-black tracking-wide text-slate-800 uppercase">
        <Icon size={16} className="text-brand-primary" /> {title} ({videos.length})
      </h4>
      {!videos.length ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">{empty}</p>
      ) : (
        <div className={cn("grid gap-6", videos[0]?.orientation === "horizontal" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
          {videos.map((video) => {
            const playable = isPlayable(video);
            const vertical = video.orientation !== "horizontal";
            return (
              <article key={video.id} className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[#F1F5F9] bg-slate-50 transition-all hover:border-brand-primary hover:shadow-md">
                {playable ? (
                  <button type="button" onClick={() => onPlay(video)} className={cn("relative flex cursor-pointer items-center justify-center overflow-hidden bg-slate-900", vertical ? "aspect-[9/16] max-h-[320px]" : "aspect-video")}>
                    <VideoPlayer src={video.url} muted preload="metadata" controls={false} className="h-full w-full object-cover opacity-70 transition-all group-hover:scale-105" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-all group-hover:bg-black/45">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white shadow-lg backdrop-blur-md">
                        <Play size={24} fill="currentColor" className="translate-x-0.5" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 rounded bg-black/55 px-2 py-0.5 font-mono text-[10px] font-medium tracking-tight text-white shadow backdrop-blur-sm">{t("hosted")}</div>
                  </button>
                ) : (
                  <div className={cn("flex flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center text-white", vertical ? "aspect-[9/16] max-h-[320px]" : "aspect-video")}>
                    <Download size={28} className="text-amber-300" />
                    <p className="text-xs font-bold">{t("largeFile")}</p>
                    <p className="max-w-[16rem] text-[11px] leading-relaxed text-slate-300">{t("largeFileHint")}</p>
                    {formatMb(video.file_size) ? <span className="font-mono text-[10px] text-slate-400">{formatMb(video.file_size)}</span> : null}
                    <a href={downloadHref(video)} download className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-900 uppercase hover:bg-slate-100">
                      <Download size={12} /> {t("downloadVideo")}
                    </a>
                  </div>
                )}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h4 className="truncate pr-4 text-sm font-bold text-[#0F172A] group-hover:text-brand-primary">{video.title}</h4>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#64748B]">{video.description || t("noDescription")}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                    {playable ? (
                      <button type="button" onClick={() => onPlay(video)} className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-brand-primary uppercase">
                        <Eye size={12} /> {t("watch")}
                      </button>
                    ) : (
                      <a href={downloadHref(video)} download className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-brand-primary uppercase">
                        <Download size={12} /> {t("downloadVideo")}
                      </a>
                    )}
                    {canUpload ? (
                      <button type="button" onClick={() => onRemove(video)} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
