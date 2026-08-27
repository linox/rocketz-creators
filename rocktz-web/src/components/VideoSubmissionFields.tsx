"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, UploadCloud, Video } from "lucide-react";
import { alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { MAX_VIDEO_UPLOAD_BYTES } from "@/lib/media-upload";

type Props = {
  file: File | null;
  downloadUrl: string;
  onFileSelect: (file: File | null) => void;
  onDownloadUrlChange: (url: string) => void;
  disabled?: boolean;
  versionBadge?: string | null;
  attachedHint?: string | null;
  requiresNewFile?: boolean;
  showPreviousAttached?: boolean;
  compact?: boolean;
};

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoSubmissionFields({
  file,
  downloadUrl,
  onFileSelect,
  onDownloadUrlChange,
  disabled = false,
  versionBadge = null,
  attachedHint = null,
  requiresNewFile = false,
  showPreviousAttached = false,
  compact = false,
}: Props) {
  const { t: tp } = useTranslation("profile");
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  async function pickFile(next?: File) {
    if (!next || disabled) return;
    if (!next.type.startsWith("video/")) {
      await alertWarning(tp("invalidVideoTitle"), tp("invalidVideo"));
      return;
    }
    if (next.size > MAX_VIDEO_UPLOAD_BYTES) {
      await alertWarning(tp("invalidVideoTitle"), tp("videoTooBig"));
      return;
    }
    onDownloadUrlChange("");
    onFileSelect(next);
  }

  function clearFile() {
    onFileSelect(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (!disabled) void pickFile(event.dataTransfer.files?.[0]);
        }}
        onClick={() => {
          if (!disabled) fileRef.current?.click();
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-all sm:p-5",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          dragActive ? "border-brand-primary bg-indigo-50/40" : "border-slate-200 bg-slate-50/60 hover:border-brand-primary/60",
          file ? "border-emerald-300 bg-emerald-50/20" : "",
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi,video/*,.mp4,.mov,.webm,.mkv,.avi"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            void pickFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className={cn("rounded-xl p-2.5", file ? "bg-emerald-100/70 text-emerald-600" : "bg-white text-slate-400")}>
          {file ? <Video size={compact ? 20 : 24} /> : <UploadCloud size={compact ? 20 : 24} />}
        </div>
        {file ? (
          <div className="min-w-0 max-w-full px-2">
            <p className="m-0 text-xs font-bold text-emerald-700">{tp("fileSelected")}</p>
            <p className="m-0 mt-0.5 truncate font-mono text-[11px] text-slate-600">
              {file.name} ({formatMb(file.size)})
              {versionBadge ? ` · ${versionBadge}` : null}
            </p>
            {!disabled ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  clearFile();
                }}
                className="mt-2 cursor-pointer text-[10px] font-bold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              >
                {tp("removeSelectedFile")}
              </button>
            ) : null}
          </div>
        ) : showPreviousAttached && attachedHint ? (
          <p className={cn("m-0 px-2 text-[11px] font-semibold", requiresNewFile ? "text-amber-700" : "text-emerald-700")}>
            {attachedHint}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className={cn("font-bold text-slate-900", compact ? "text-[11px]" : "text-xs")}>{tp("dropLabel")}</span>
            <span className="text-[10px] tracking-wider text-slate-500 uppercase">{tp("dropFormats")}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{tp("uploadOrDownloadLink")}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          <Link2 size={12} className="text-brand-primary" />
          {tp("downloadLinkLabel")}
        </label>
        <input
          type="url"
          inputMode="url"
          placeholder={tp("downloadLinkPh")}
          value={downloadUrl}
          disabled={disabled || Boolean(file)}
          onChange={(event) => {
            if (file) clearFile();
            onDownloadUrlChange(event.target.value);
          }}
          className={cn(
            "w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs outline-none focus:border-brand-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70",
            compact ? "h-9" : "h-10",
          )}
        />
        <p className="m-0 text-[10px] leading-relaxed text-slate-500">{tp("downloadLinkHint")}</p>
      </div>
    </div>
  );
}
