"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Check, Instagram, Mail, MapPin, Smartphone, Sparkles, UploadCloud, User, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ImageCropModal } from "@/components/ImageCropModal";
import { CountrySelect, RegionSelect } from "@/components/GeoSelectFields";
import { UserAvatar } from "@/components/UserAvatar";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { fetchMe } from "@/lib/laravel";
import { formatInstagram, formatTikTok, formatWhatsApp, instagramHandle, nationalPhoneDigits } from "@/lib/masks";
import { DEFAULT_COUNTRY, hasRegions, isValidRegion } from "@/lib/geo";

type EditProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  onProfileUpdated: (user: AuthUser) => void;
};

export function EditProfileModal({ isOpen, onClose, user, onProfileUpdated }: EditProfileModalProps) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasCreator = Boolean(user.creator?.id);
  const isCompany = user.role === "company";
  const [fullName, setFullName] = useState("");
  const [artisticName, setArtisticName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [state, setState] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCropSrc(null);
    setFullName(user.creator?.full_name || user.name);
    setArtisticName(user.creator?.artistic_name || "");
    setCompanyName(user.company?.name || "");
    setPhotoUrl(user.creator?.photo_url || user.company?.logo_url || user.avatar_url || "");
    setWhatsapp(formatWhatsApp(user.creator?.whatsapp || user.company?.whatsapp || ""));
    setInstagram(formatInstagram(user.creator?.socials?.instagram || ""));
    setTiktok(formatTikTok(user.creator?.socials?.tiktok || "").replace(/^@+/, ""));
    setCity(user.creator?.city || user.company?.city || "");
    setCountry(user.creator?.country || user.company?.country || DEFAULT_COUNTRY);
    setState(user.creator?.state || "");
    setBio("");
  }, [isOpen, user]);

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
    setUploadProgress(20);
    try {
      setUploadProgress(55);
      const uploaded = await api.uploadMedia(blob, "avatar.jpg");
      setUploadProgress(100);
      setPhotoUrl(uploaded.data.url);
      await alertSuccess(t("editProfile.photoUploaded"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgress(0);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fullName.trim()) {
      await alertWarning(t("editProfile.nameRequiredTitle"), t("editProfile.nameRequired"));
      return;
    }
    if (hasCreator && hasRegions(country) && !isValidRegion(country, state)) {
      await alertWarning(tc("alerts.regionRequiredTitle"), tc("alerts.regionRequired"));
      return;
    }

    setLoading(true);

    try {
      const trimmedPhoto = photoUrl.trim() || null;

      await api.updateMe({
        name: fullName.trim(),
        avatar_url: trimmedPhoto,
      });

      if (hasCreator && user.creator) {
        await api.updateCreator(user.creator.id, {
          full_name: fullName.trim(),
          artistic_name: artisticName.replace(/^@+/, "").trim() || user.creator.artistic_name,
          photo_url: trimmedPhoto,
          whatsapp: nationalPhoneDigits(whatsapp) || whatsapp.trim(),
          city: city.trim(),
          country,
          state: state || user.creator.state,
          bio: bio.trim() || undefined,
          socials: {
            ...(user.creator.socials ?? {}),
            instagram: instagramHandle(instagram),
            tiktok: formatTikTok(tiktok).replace(/^@+/, ""),
          },
        });
      } else if (user.role === "company" && user.company?.id) {
        await api.updateCompany(user.company.id, {
          name: companyName.trim() || user.company.name,
          responsible_name: fullName.trim(),
          whatsapp: nationalPhoneDigits(whatsapp) || null,
          city: city.trim() || null,
          country,
          logo_url: trimmedPhoto,
        });
      }

      const next = await fetchMe();
      onProfileUpdated(next);
      await alertSuccess(t("editProfile.updated"));
      onClose();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-0 sm:p-4 app-modal-overlay">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="app-modal-panel relative z-10 my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-white shadow-md shadow-indigo-200">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">{t("editProfile.title")}</h2>
                  <p className="text-xs text-slate-500">{t("editProfile.subtitle")}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="cursor-pointer rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
              <div className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:flex-row">
                <div className="group relative shrink-0">
                  <UserAvatar src={photoUrl} name={artisticName || fullName || user.email} size="custom" shape="rounded-2xl" className="h-20 w-20 border-2 border-white shadow-md sm:h-24 sm:w-24" textClassName="text-2xl font-bold" />
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
                      onChange={(event) => setPhotoUrl(event.target.value)}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("editProfile.fullName")}</label>
                  <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={t("editProfile.fullNamePh")} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-brand-primary" />
                </div>
                {isCompany || hasCreator ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{isCompany ? t("editProfile.companyName") : t("editProfile.artisticName")}</label>
                    {isCompany ? (
                      <input type="text" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder={t("editProfile.companyNamePh")} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-brand-primary" />
                    ) : (
                      <div className="relative">
                        <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">@</span>
                        <input type="text" value={artisticName} onChange={(event) => setArtisticName(event.target.value.replace(/^@+/, ""))} placeholder={t("editProfile.artisticNamePh")} className="w-full rounded-xl border border-slate-200 py-2.5 pr-3.5 pl-8 text-sm font-semibold text-slate-800 outline-none focus:border-brand-primary" />
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("editProfile.email")}</label>
                  <div className="relative">
                    <input type="email" disabled value={user.email} className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-2.5 pr-3.5 pl-9 text-sm font-medium text-slate-500" />
                    <Mail size={16} className="absolute top-3 left-3 text-slate-400" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("editProfile.whatsapp")}</label>
                  <div className="relative">
                    <input type="text" value={whatsapp} onChange={(event) => setWhatsapp(formatWhatsApp(event.target.value))} placeholder={t("editProfile.whatsappPh")} className="w-full rounded-xl border border-slate-200 py-2.5 pr-3.5 pl-9 text-sm font-semibold text-slate-800 outline-none focus:border-brand-primary" />
                    <Smartphone size={16} className="absolute top-3 left-3 text-slate-400" />
                  </div>
                </div>
              </div>

              {hasCreator ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                      <Instagram size={13} className="text-pink-500" /> {t("editProfile.instagram")}
                    </label>
                    <input type="text" value={instagram} onChange={(event) => setInstagram(formatInstagram(event.target.value))} placeholder={t("editProfile.instagramPh")} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-primary" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                      <Sparkles size={13} className="text-rose-500" /> {t("editProfile.tiktok")}
                    </label>
                    <input type="text" value={tiktok} onChange={(event) => setTiktok(event.target.value.replace(/^@+/, ""))} placeholder={t("editProfile.tiktokPh")} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-primary" />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("editProfile.country")}</label>
                  <CountrySelect
                    theme="light"
                    placeholder={t("editProfile.countryPh")}
                    value={country}
                    onChange={(value) => {
                      setCountry(value);
                      setState("");
                    }}
                  />
                </div>
                {hasCreator ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("editProfile.state")}</label>
                    <RegionSelect theme="light" country={country} placeholder={t("editProfile.statePh")} value={state} onChange={setState} />
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                    <MapPin size={13} className="text-emerald-500" /> {t("editProfile.city")}
                  </label>
                  <input type="text" value={city} onChange={(event) => setCity(event.target.value)} placeholder={t("editProfile.cityPh")} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-primary" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("editProfile.bio")}</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder={t("editProfile.bioPh")}
                  className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-800 outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white pt-4">
                <button type="button" onClick={onClose} className="cursor-pointer rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  {tc("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading || isUploadingPhoto}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-600 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {tc("saving")}
                    </>
                  ) : (
                    <>
                      <Check size={16} /> {t("editProfile.saveChanges")}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
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
        </div>
      ) : null}
    </AnimatePresence>
  );
}
