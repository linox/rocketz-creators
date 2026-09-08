"use client";

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { FileUp, Trash2 } from "lucide-react";
import { ScriptDocumentLink } from "@/components/ScriptDocumentLink";
import { alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import {
  MAX_SCRIPT_DOCUMENT_BYTES,
  SCRIPT_DOCUMENT_ACCEPT,
  isScriptDocumentFile,
  parseScriptDocument,
  type ScriptDocumentRef,
} from "@/lib/script-document";

type Props = {
  label?: string;
  hint?: string;
  file: File | null;
  existing?: ScriptDocumentRef | null;
  onFileSelect: (file: File | null) => void;
  onClearExisting?: () => void;
  disabled?: boolean;
  compact?: boolean;
};

export function ScriptDocumentField({
  label,
  hint,
  file,
  existing,
  onFileSelect,
  onClearExisting,
  disabled = false,
  compact = false,
}: Props) {
  const { t } = useTranslation("app");
  const { t: tp } = useTranslation("profile");
  const fileRef = useRef<HTMLInputElement>(null);
  const attached = file
    ? { url: "", filename: file.name }
    : parseScriptDocument(existing?.url, existing?.filename);

  async function pickFile(next?: File) {
    if (!next || disabled) return;
    if (!isScriptDocumentFile(next) || next.size > MAX_SCRIPT_DOCUMENT_BYTES) {
      await alertWarning(tp("invalidScriptFileTitle"), tp("invalidScriptFile"));
      return;
    }
    onFileSelect(next);
  }

  function clear() {
    onFileSelect(null);
    onClearExisting?.();
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2")}>
      {label ? (
        <label className="flex items-center justify-between font-bold text-slate-700">
          <span>{label}</span>
          {hint ? <span className="text-[10px] font-normal text-slate-400">{hint}</span> : null}
        </label>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept={SCRIPT_DOCUMENT_ACCEPT}
        disabled={disabled}
        className="hidden"
        onChange={(event) => void pickFile(event.target.files?.[0])}
      />
      {attached ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2">
          {file ? (
            <span className="truncate text-[11px] font-semibold text-slate-800">{file.name}</span>
          ) : (
            <ScriptDocumentLink url={attached.url} filename={attached.filename} />
          )}
          {!disabled ? (
            <button
              type="button"
              onClick={clear}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={12} /> {t("recurringDetail.removeScriptFile")}
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60",
            compact ? "h-10" : "py-3",
          )}
        >
          <FileUp size={14} /> {tp("chooseScriptFile")}
        </button>
      )}
    </div>
  );
}
