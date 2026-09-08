"use client";

import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { safeHttpUrl } from "@/lib/safe-http-url";

type Props = {
  url?: string | null;
  filename?: string | null;
  className?: string;
};

export function ScriptDocumentLink({ url, filename, className }: Props) {
  const { t } = useTranslation("app");
  const href = safeHttpUrl(url);
  if (!href) return null;
  const label = (filename || "").trim() || t("recurringDetail.downloadScriptFile");

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className ?? "inline-flex min-w-0 items-center gap-1.5 truncate text-[11px] font-bold text-brand-primary hover:underline"}
    >
      <FileText size={13} className="shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}
