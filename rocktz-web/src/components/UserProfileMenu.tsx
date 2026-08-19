"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  ChevronDown,
  Edit3,
  FileText,
  Instagram,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { UserAvatar } from "@/components/UserAvatar";
import type { AuthUser, UserRole } from "@/lib/auth";
import { cn } from "@/lib/cn";

export type ProfileMenuData = {
  fullName: string;
  artisticName?: string;
  photoUrl?: string | null;
  email: string;
  phone?: string;
  instagram?: string;
  city?: string;
  state?: string;
};

type UserProfileMenuProps = {
  user: AuthUser;
  role: UserRole;
  userData: ProfileMenuData;
  onOpenEditProfile: () => void;
  onOpenLgpdModal: () => void;
  onOpenContractModal?: () => void;
  onLogout: () => void;
  variant?: "header" | "sidebar";
};

function roleBadge(role: UserRole, t: (key: string) => string, companyName?: string) {
  if (role === "admin") {
    return {
      label: t("roleAdmin"),
      bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
      dot: "bg-indigo-500",
    };
  }
  if (role === "company") {
    return {
      label: t("roleCompany"),
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
      sublabel: companyName,
    };
  }
  return {
    label: t("roleCreator"),
    bg: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  };
}

export function UserProfileMenu({
  user,
  role,
  userData,
  onOpenEditProfile,
  onOpenLgpdModal,
  onOpenContractModal,
  onLogout,
  variant = "header",
}: UserProfileMenuProps) {
  const { t } = useTranslation("nav");
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = userData.fullName || user.name || t("user");
  const artisticName = userData.artisticName;
  const photoURL = userData.photoUrl;
  const email = userData.email || user.email;
  const phone = userData.phone || "";
  const instagram = userData.instagram || "";
  const locationText = [userData.city, userData.state].filter(Boolean).join(" - ");
  const roleInfo = roleBadge(role, t, user.company?.name);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (variant === "sidebar") {
    return (
      <div className="relative" ref={menuRef}>
        <div className="rounded-2xl border border-[#334155] bg-[#1e293b]/70 p-2">
          <div className="flex items-center gap-2.5 p-1.5">
            <div className="relative shrink-0">
              <UserAvatar src={photoURL} name={displayName} size="custom" className="h-9 w-9 border border-slate-600 shadow-xs" textClassName="text-xs" />
              <span className={cn("absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#1e293b]", roleInfo.dot)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white">{displayName}</p>
              <p className="truncate text-[10px] text-slate-400">{email}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-[#334155]/60 pt-2">
            <button
              type="button"
              onClick={onOpenEditProfile}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-brand-primary"
              title={t("editProfileTitle")}
            >
              <Edit3 size={13} />
              <span>{t("editProfile")}</span>
            </button>
            <button type="button" onClick={onLogout} className="cursor-pointer rounded-lg p-1.5 text-rose-400 transition-colors hover:bg-rose-500/20 hover:text-white" title={t("logoutAccount")}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "group flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white pr-3 pl-1.5 shadow-xs transition-all hover:border-slate-300",
          isOpen && "border-brand-primary ring-2 ring-brand-primary/20",
        )}
        title={t("userMenu")}
      >
        <div className="relative shrink-0">
          <UserAvatar src={photoURL} name={displayName} size="custom" shape="rounded-lg" className="h-7 w-7 border border-slate-200" textClassName="text-[10px]" />
          <span className={cn("absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-white", roleInfo.dot)} />
        </div>
        <div className="hidden flex-col text-left sm:flex">
          <span className="max-w-[120px] truncate text-xs leading-tight font-bold text-slate-800">{displayName.split(" ")[0]}</span>
          <span className="text-[10px] leading-tight font-medium text-slate-400">{roleInfo.label}</span>
        </div>
        <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-200 group-hover:text-slate-700", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 z-50 mt-2 flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[22rem]"
          >
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <UserAvatar src={photoURL} name={displayName} size="custom" shape="rounded-2xl" className="h-[3.25rem] w-[3.25rem] border-2 border-white shadow-md" textClassName="text-base" />
                  <span className={cn("absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs", roleInfo.dot)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase", roleInfo.bg)}>{roleInfo.label}</span>
                    {artisticName ? <span className="text-[10px] font-medium text-slate-500">({artisticName})</span> : null}
                  </div>
                  <h3 className="truncate text-sm font-black text-slate-900" title={displayName}>
                    {displayName}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                    <Mail size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate">{email}</span>
                  </div>
                </div>
              </div>

              {phone || instagram || locationText ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/60 pt-3 text-[11px] text-slate-600">
                  {phone ? (
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-xs">
                      <Smartphone size={11} className="text-slate-400" />
                      <span>{phone}</span>
                    </div>
                  ) : null}
                  {instagram ? (
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-xs">
                      <Instagram size={11} className="text-pink-500" />
                      <span>@{instagram.replace(/^@/, "")}</span>
                    </div>
                  ) : null}
                  {locationText ? (
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-xs">
                      <MapPin size={11} className="text-emerald-500" />
                      <span>{locationText}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="border-b border-slate-100 bg-white p-3">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenEditProfile();
                }}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-600 active:scale-[0.98]"
              >
                <Edit3 size={15} />
                <span>{t("editMyProfile")}</span>
              </button>
            </div>

            <div className="space-y-1 p-2">
              {role === "creator" && user.creator?.id ? (
                <>
                  <Link href={`/creators/${user.creator.id}`} onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={15} className="text-brand-primary" />
                      <span>{t("mediaKit")}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{t("public")}</span>
                  </Link>
                  <Link href={`/creators/${user.creator.id}`} onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
                    <div className="flex items-center gap-2.5">
                      <Megaphone size={15} className="text-amber-500" />
                      <span>{t("myCampaigns")}</span>
                    </div>
                  </Link>
                  <Link href={`/creators/${user.creator.id}`} onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
                    <div className="flex items-center gap-2.5">
                      <Video size={15} className="text-teal-500" />
                      <span>{t("portfolioVideos")}</span>
                    </div>
                  </Link>
                </>
              ) : null}

              {role === "admin" ? (
                <Link href="/admin-users" onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
                  <div className="flex items-center gap-2.5">
                    <Users size={15} className="text-indigo-600" />
                    <span>{t("teamUsers")}</span>
                  </div>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">{t("adminBadge")}</span>
                </Link>
              ) : null}

              {role === "company" ? (
                <Link href="/company-dashboard" onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
                  <div className="flex items-center gap-2.5">
                    <Building2 size={15} className="text-emerald-600" />
                    <span>{t("companyPanel")}</span>
                  </div>
                </Link>
              ) : null}

              {onOpenContractModal ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenContractModal();
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-purple-50 hover:text-purple-700"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText size={15} className="text-purple-600" />
                    <span>{t("contractTerm")}</span>
                  </div>
                  <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-600">{t("official")}</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenLgpdModal();
                }}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  <span>{t("lgpdProtection")}</span>
                </div>
              </button>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/60 p-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50"
              >
                <LogOut size={15} className="text-rose-500" />
                <span>{t("logoutAccount")}</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
