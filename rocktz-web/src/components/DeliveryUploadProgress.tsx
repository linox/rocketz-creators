"use client";

import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { useOptionalUploadManager } from "@/contexts/UploadManagerContext";
import { uploadProgressValue } from "@/lib/content-delivery-status";
import { cancelMediaUpload } from "@/lib/laravel";

type Props = {
  subjectType: "campaign_creator" | "content_planning_item";
  subjectId: number;
  pendingUploadId?: string | null;
  uploadProgress?: number | null;
  onCancelled?: () => void;
};

export function DeliveryUploadProgress({ subjectType, subjectId, pendingUploadId, uploadProgress, onCancelled }: Props) {
  const { t: tp } = useTranslation("profile");
  const uploadManager = useOptionalUploadManager();
  const localProgress = uploadManager?.getSubjectProgress(subjectType, subjectId) ?? null;
  const active = Boolean(pendingUploadId) || uploadManager?.isSubjectUploading(subjectType, subjectId);
  const progress = uploadProgressValue({ pending_upload_id: pendingUploadId, upload_progress: uploadProgress }, localProgress);

  if (!active || progress === null) return null;

  async function cancelStuckUpload() {
    const uploadId = pendingUploadId ?? uploadManager?.activeUploads.find(
      (task) => task.subjectType === subjectType && task.subjectId === subjectId,
    )?.uploadId;
    if (!uploadId) return;
    if (uploadManager?.activeUploads.some((task) => task.uploadId === uploadId)) {
      await uploadManager.cancelActiveUpload(uploadId);
    } else {
      try {
        await cancelMediaUpload(uploadId);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("rocketz:upload-complete"));
    }
    onCancelled?.();
  }

  return (
    <div className="mt-2 flex w-full max-w-xs flex-col gap-1.5">
      <UploadProgressBar progress={progress} />
      <button
        type="button"
        onClick={() => void cancelStuckUpload()}
        className="inline-flex cursor-pointer items-center gap-1 self-start text-[10px] font-bold text-rose-700 hover:underline"
      >
        <X size={12} />
        {tp("cancelUpload")}
      </button>
    </div>
  );
}
