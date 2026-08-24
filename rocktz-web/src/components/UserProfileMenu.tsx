"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Building2,
  ChevronDown,
  Edit3,
  FileText,
  Home,
  Instagram,
  KeyRound,
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
import { motion } from "motion/react";
import { UserAvatar } from "@/components/UserAvatar";
import type { AuthUser, UserRole } from "@/lib/auth";
import { userHasPermission } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatWhatsApp, instagramHandle, nationalPhoneDigits } from "@/lib/masks";
import { formatLocation } from "@/lib/geo";

export type ProfileMenuData = {
  fullName: string;
  artisticName?: string;
  photoUrl?: string | null;
  email: string;
  phone?: string;
  instagram?: string;
  city?: string;
  state?: string;
  country?: string;
};

type UserProfileMenuProps = {
  user: AuthUser;
  role: UserRole;
  userData: ProfileMenuData;
  onOpenEditProfile?: () => void;
  onOpenLgpdModal?: () => void;
  onOpenContractModal?: () => void;
  onLogout: () => void;
  variant?: "header" | "sidebar";
};

type MenuPos = { top: number; left: number; width: number; maxHeight: number };

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

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1) : word))
    .join(" ");
}

function formatArtisticName(value?: string) {
  const raw = value?.trim() || "";
  if (!raw) return "";
  if (/instagram\.com|https?:\/\//i.test(raw)) return instagramHandle(raw);
  return raw.replace(/^@+/, "");
}

function displayPhone(value: string) {
  const digits = nationalPhoneDigits(value);
  if (digits.length < 10) return "";
  return formatWhatsApp(digits);
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
  const { t, i18n } = useTranslation("nav");
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const displayName = userData.fullName || user.name || t("user");
  const instagram = instagramHandle(userData.instagram || "");
  const artisticName = formatArtisticName(userData.artisticName);
  const showArtisticName = Boolean(artisticName && artisticName.toLowerCase() !== instagram.toLowerCase());
  const photoURL = userData.photoUrl;
  const email = userData.email || user.email;
  const phone = userData.phone ? displayPhone(userData.phone) : "";
  const phoneDigits = userData.phone ? nationalPhoneDigits(userData.phone) : "";
  const locationText = formatLocation(i18n.language, { city: userData.city ? titleCase(userData.city) : "", state: userData.state, country: userData.country });
  const roleInfo = roleBadge(role, t, user.company?.name);

  function placeMenu() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 320 && spaceAbove > spaceBelow;
    const top = openUp ? Math.max(12, rect.top - Math.min(480, spaceAbove) - 8) : rect.bottom + 8;
    const maxHeight = Math.max(240, openUp ? rect.top - top - 8 : window.innerHeight - top - 12);
    setPos({ top, left, width, maxHeight });
  }

  useEffect(() => {
    if (!isOpen) return;

    placeMenu();

    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <UserAvatar src={photoURL} name={displayName} size="custom" shape="rounded-2xl" className="h-[3.25rem] w-[3.25rem] border-2 border-white shadow-md" textClassName="text-base" />
            <span className={cn("absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs", roleInfo.dot)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase", roleInfo.bg)}>{roleInfo.label}</span>
              {showArtisticName ? <span className="truncate text-[10px] font-medium text-slate-500">({artisticName})</span> : null}
            </div>
            <h3 className="truncate text-sm font-black text-slate-900" title={displayName}>
              {displayName}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <Mail size={12} className="shrink-0 text-slate-400" />
              <span className="truncate">{email}</span>
            </div>
          </div>
        </div>

        {phone || instagram || locationText ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/60 pt-3 text-[11px] text-slate-600">
            {phone ? (
              <a href={`tel:+55${phoneDigits}`} className="flex max-w-full items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-xs hover:border-slate-300">
                <Smartphone size={11} className="shrink-0 text-slate-400" />
                <span className="truncate">{phone}</span>
              </a>
            ) : null}
            {instagram ? (
              <a
                href={`https://instagram.com/${instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex max-w-full items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-xs hover:border-pink-200 hover:text-pink-700"
              >
                <Instagram size={11} className="shrink-0 text-pink-500" />
                <span className="truncate">@{instagram}</span>
              </a>
            ) : null}
            {locationText ? (
              <div className="flex max-w-full items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-xs">
                <MapPin size={11} className="shrink-0 text-emerald-500" />
                <span className="truncate">{locationText}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {onOpenEditProfile ? (
        <div className="shrink-0 border-b border-slate-100 bg-white p-3">
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
      ) : null}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {role === "creator" && user.creator?.id ? (
          <>
            <Link href={`/creators/${user.creator.id}?tab=dashboard`} onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
              <div className="flex items-center gap-2.5">
                <Home size={15} className="text-indigo-500" />
                <span>{t("home")}</span>
              </div>
            </Link>
            <Link href={`/creators/${user.creator.id}?tab=about`} onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
              <div className="flex items-center gap-2.5">
                <Sparkles size={15} className="text-brand-primary" />
                <span>{t("mediaKit")}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t("public")}</span>
            </Link>
            <Link href={`/creators/${user.creator.id}?tab=campaigns`} onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
              <div className="flex items-center gap-2.5">
                <Megaphone size={15} className="text-amber-500" />
                <span>{t("myCampaigns")}</span>
              </div>
            </Link>
            <Link href={`/creators/${user.creator.id}?tab=portfolio`} onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
              <div className="flex items-center gap-2.5">
                <Video size={15} className="text-teal-500" />
                <span>{t("portfolioVideos")}</span>
              </div>
            </Link>
          </>
        ) : null}

        {role === "admin" && userHasPermission(user, "users.manage") ? (
          <Link href="/users" onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
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
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText size={15} className="shrink-0 text-purple-600" />
              <span className="truncate">{t("contractTerm")}</span>
            </div>
            <span className="shrink-0 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-600">{t("official")}</span>
          </button>
        ) : null}

        <Link href="/settings/security" onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
          <div className="flex items-center gap-2.5">
            <KeyRound size={15} className="text-indigo-600" />
            <span>{t("securitySettings")}</span>
          </div>
        </Link>

        <Link href="/settings/notifications" onClick={() => setIsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-primary">
          <div className="flex items-center gap-2.5">
            <Mail size={15} className="text-indigo-600" />
            <span>{t("notificationSettings")}</span>
          </div>
        </Link>

        {onOpenLgpdModal ? (
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenLgpdModal();
            }}
            className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
              <span className="truncate">{t("lgpdProtection")}</span>
            </div>
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-2">
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
    </div>
  );

  if (variant === "sidebar") {
    return (
      <div className="relative">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-2 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 p-1.5">
            <div className="relative shrink-0">
              <UserAvatar src={photoURL} name={displayName} size="custom" className="h-9 w-9 border border-white/30 shadow-xs" textClassName="text-xs" />
              <span className={cn("absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#8A3FFC]", roleInfo.dot)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white">{displayName}</p>
              <p className="truncate text-[10px] text-white/70">{email}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-white/15 pt-2">
            {onOpenEditProfile ? (
              <button
                type="button"
                onClick={onOpenEditProfile}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white/15 px-2 py-1.5 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-white/25"
                title={t("editProfileTitle")}
              >
                <Edit3 size={13} />
                <span>{t("editProfile")}</span>
              </button>
            ) : null}
            <button type="button" onClick={onLogout} className="cursor-pointer rounded-lg p-1.5 text-rose-200 transition-colors hover:bg-rose-500/30 hover:text-white" title={t("logoutAccount")}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }
          placeMenu();
          setIsOpen(true);
        }}
        className={cn(
          "group flex h-10 max-w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white pr-2.5 pl-1.5 shadow-xs transition-all hover:border-slate-300 sm:pr-3",
          isOpen && "border-brand-primary ring-2 ring-brand-primary/20",
        )}
        title={t("userMenu")}
      >
        <div className="relative shrink-0">
          <UserAvatar src={photoURL} name={displayName} size="custom" shape="rounded-lg" className="h-7 w-7 border border-slate-200" textClassName="text-[10px]" />
          <span className={cn("absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-white", roleInfo.dot)} />
        </div>
        <div className="hidden min-w-0 flex-col text-left sm:flex">
          <span className="max-w-[100px] truncate text-xs leading-tight font-bold text-slate-800 lg:max-w-[120px]">{displayName.split(" ")[0]}</span>
          <span className="max-w-[100px] truncate text-[10px] leading-tight font-medium text-slate-400 lg:max-w-[120px]">{roleInfo.label}</span>
        </div>
        <ChevronDown size={14} className={cn("shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-700", isOpen && "rotate-180")} />
      </button>

      {isOpen && pos
        ? createPortal(
            <motion.div
              ref={panelRef}
              role="menu"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
              className="fixed z-[200] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {panel}
            </motion.div>,
            document.body,
          )
        : null}
    </div>
  );
}
