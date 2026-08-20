"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Image as ImageIcon, Info, Link as LinkIcon, RefreshCw, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { alertApiError, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";

const PRESETS = [
  { key: "fashion", url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80" },
  { key: "beauty", url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&auto=format&fit=crop&q=80" },
  { key: "tech", url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80" },
  { key: "food", url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80" },
  { key: "fitness", url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1200&auto=format&fit=crop&q=80" },
  { key: "travel", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80" },
  { key: "games", url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&auto=format&fit=crop&q=80" },
  { key: "retail", url: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80" },
] as const;

type Tab = "upload" | "url" | "presets";

export function CampaignImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const { t } = useTranslation("app");
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("upload");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState(value && !value.startsWith("data:") ? value : "");
  const [imageError, setImageError] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      await alertWarning(t("campaigns.coverInvalid"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      await alertWarning(t("campaigns.coverTooBig"));
      return;
    }
    setUploading(true);
    setImageError(false);
    try {
      const uploaded = await api.uploadMedia(file, file.name);
      onChange(uploaded.data.url);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    onChange("");
    setUrlInput("");
    setImageError(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const tabClass = (active: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1 text-[11px] font-bold transition-all",
      active ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800",
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-700 uppercase">
          <ImageIcon size={14} className="text-brand-primary" />
          {t("campaigns.coverLabel")}
        </label>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
          <Info size={11} className="text-slate-400" />
          {t("campaigns.coverBadge")}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 shadow-xs">
        {value && !imageError ? (
          <div className="group relative flex h-28 w-full items-center justify-center overflow-hidden bg-slate-950 sm:h-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" referrerPolicy="no-referrer" onError={() => setImageError(true)} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 rounded-lg bg-emerald-500/90 px-2 py-1 text-[10px] font-black tracking-wider text-white uppercase">
                  <CheckCircle2 size={12} /> {t("campaigns.coverDefined")}
                </span>
                <button type="button" onClick={remove} className="rounded-xl bg-rose-600/90 p-1.5 text-white hover:bg-rose-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex justify-center">
                <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-extrabold text-slate-900">
                  <RefreshCw size={13} /> {t("campaigns.coverChange")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const file = event.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            onClick={() => !uploading && fileRef.current?.click()}
            className={cn(
              "flex min-h-[4.5rem] cursor-pointer items-center gap-3 border-2 border-dashed px-4 py-3 transition-all",
              dragOver ? "border-brand-primary bg-indigo-50/50" : "border-slate-300 bg-slate-50/50 hover:border-slate-400",
            )}
          >
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                <span className="text-xs font-bold text-slate-700">{t("campaigns.coverUploading")}</span>
              </div>
            ) : (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-brand-primary">
                  <UploadCloud size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">
                    {t("campaigns.coverDrop")}{" "}
                    <span className="font-extrabold text-brand-primary">{t("campaigns.coverClick")}</span>
                  </p>
                  <p className="text-[10px] text-slate-400">{t("campaigns.coverHint")}</p>
                </div>
              </>
            )}
          </div>
        )}
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

      <div className="flex w-fit items-center gap-1.5 rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => setTab("upload")} className={tabClass(tab === "upload")}>
          <UploadCloud size={12} /> {t("campaigns.coverFile")}
        </button>
        <button type="button" onClick={() => setTab("url")} className={tabClass(tab === "url")}>
          <LinkIcon size={12} /> {t("campaigns.coverUrl")}
        </button>
        <button type="button" onClick={() => setTab("presets")} className={tabClass(tab === "presets")}>
          <Sparkles size={12} className="text-amber-500" /> {t("campaigns.coverGallery")}
        </button>
      </div>

      {tab === "upload" && value ? (
        <button type="button" onClick={remove} className="self-start rounded-lg px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50">
          {t("campaigns.coverRemove")}
        </button>
      ) : null}

      {tab === "url" ? (
        <div className="flex items-center gap-2">
          <input
            type="url"
            placeholder={t("campaigns.coverUrlPh")}
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-brand-primary"
          />
          <button
            type="button"
            onClick={() => {
              if (!urlInput.trim()) return;
              onChange(urlInput.trim());
              setImageError(false);
            }}
            className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            {t("campaigns.coverApplyUrl")}
          </button>
        </div>
      ) : null}

      {tab === "presets" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                onChange(preset.url);
                setUrlInput(preset.url);
                setImageError(false);
              }}
              className={cn(
                "group relative aspect-[16/9] overflow-hidden rounded-xl border-2 p-0 text-left",
                value === preset.url ? "border-brand-primary ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-400",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preset.url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-slate-950/80 to-transparent p-2">
                <span className="text-[10px] leading-tight font-bold text-white">{t(`campaigns.preset.${preset.key}`)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
