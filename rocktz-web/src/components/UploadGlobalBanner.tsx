"use client";

import Link from "next/link";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { UploadCloud, X } from "lucide-react";
import { useOptionalUploadManager } from "@/contexts/UploadManagerContext";
import { AuthUserContext } from "@/lib/use-auth";

export function UploadGlobalBanner() {
  const { t: tp } = useTranslation("profile");
  const uploadManager = useOptionalUploadManager();
  const user = useContext(AuthUserContext);

  if (!uploadManager || uploadManager.activeUploads.length === 0) return null;

  const creatorId = user?.creator?.id;
  const dashboardHref = creatorId ? `/creators/${creatorId}?tab=dashboard` : "/";

  return (
    <div className="fixed inset-x-0 top-0 z-[200] border-b border-indigo-200 bg-indigo-50/95 px-3 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        {uploadManager.activeUploads.map((task) => (
          <div key={task.uploadId} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-indigo-900">
              <UploadCloud size={14} className="shrink-0" />
              <span className="truncate">
                {tp("uploadInProgress")} — {task.label} — {Math.round(task.progress)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-indigo-100 sm:w-40 sm:flex-none">
                <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${task.progress}%` }} />
              </div>
              {creatorId ? (
                <Link href={dashboardHref} className="shrink-0 text-[11px] font-bold text-brand-primary hover:underline">
                  {tp("viewUploadProgress")}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void uploadManager.cancelActiveUpload(task.uploadId)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
              >
                <X size={12} />
                {tp("cancelUpload")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
