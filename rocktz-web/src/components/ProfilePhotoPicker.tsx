"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, UploadCloud } from "lucide-react";
import { ImageCropModal } from "@/components/ImageCropModal";
import { UserAvatar } from "@/components/UserAvatar";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { api } from "@/lib/api";

type Props = {
  photoUrl: string;
  name: string;
  onPhotoUrlChange: (url: string) => void;
  onUploadingChange?: (busy: boolean) => void;
};

export function ProfilePhotoPicker({ photoUrl, name, onPhotoUrlChange, onUploadingChange }: Props) {
  const { t } = useTranslation("app");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function pickFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      void alertWarning(t("editProfile.invalidImageTitle"), t("editProfile.invalidImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      void alertWarning(t("editProfile.fileTooLargeTitle"), t("editProfile.fileTooLarge"));
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  }

  async function handleCropped(blob: Blob) {
    const preview = cropSrc;
    setCropSrc(null);
    if (preview) URL.revokeObjectURL(preview);

    setIsUploadingPhoto(true);
    onUploadingChange?.(true);
    setUploadProgress(20);
    try {
      setUploadProgress(55);
      const uploaded = await api.uploadMedia(blob, "avatar.jpg");
      setUploadProgress(100);
      onPhotoUrlChange(uploaded.data.url);
      await alertSuccess(t("editProfile.photoUploaded"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setIsUploadingPhoto(false);
      onUploadingChange?.(false);
      setUploadProgress(0);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:flex-row">
        <div className="group relative shrink-0">
          <UserAvatar src={photoUrl} name={name} size="custom" shape="rounded-2xl" className="h-20 w-20 border-2 border-white shadow-md sm:h-24 sm:w-24" textClassName="text-2xl font-bold" />
          <button
            type="button"
            onClick={pickFile}
            disabled={isUploadingPhoto}
            className="absolute -right-2 -bottom-2 cursor-pointer rounded-xl bg-brand-primary p-2 text-white shadow-md transition-colors hover:bg-indigo-600 disabled:opacity-50"
            title={t("editProfile.changePhoto")}
          >
            <Camera size={14} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
        </div>
        <div className="w-full flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("editProfile.photoLabel")}</label>
            {isUploadingPhoto ? <span className="animate-pulse text-[10px] font-bold text-brand-primary">{t("editProfile.uploading", { progress: uploadProgress })}</span> : null}
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={photoUrl}
              onChange={(event) => onPhotoUrlChange(event.target.value)}
              placeholder={t("editProfile.photoUrlPh")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand-primary"
            />
            <button
              type="button"
              onClick={pickFile}
              disabled={isUploadingPhoto}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              <UploadCloud size={14} /> {t("editProfile.upload")}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">{t("editProfile.photoHint")}</p>
        </div>
      </div>
      {cropSrc ? (
        <ImageCropModal
          imageSrc={cropSrc}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onConfirm={handleCropped}
        />
      ) : null}
    </>
  );
}
