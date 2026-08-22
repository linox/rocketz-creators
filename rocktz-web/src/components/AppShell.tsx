"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  Eye,
  EyeOff,
  Globe,
  Home,
  LayoutDashboard,
  Megaphone,
  Menu,
  MoreHorizontal,
  Repeat,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { CreatorSwitcher } from "@/components/CreatorSwitcher";
import { CreatorContractModal } from "@/components/CreatorContractModal";
import { CreatorContractRequiredBanner } from "@/components/CreatorContractRequiredBanner";
import { EditProfileModal } from "@/components/EditProfileModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LgpdBanner } from "@/components/LgpdBanner";
import { LgpdPrivacyModal } from "@/components/LgpdPrivacyModal";
import { RocketzLogo } from "@/components/RocketzLogo";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess } from "@/lib/alerts";
import type { AuthUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { fetchMe, logoutRequest } from "@/lib/laravel";
import { usePrivacy } from "@/lib/privacy";
import { useTranslation } from "react-i18next";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
};

function normalizePath(path: string) {
  if (!path) return "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed || "/";
}

function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: NavItem & { active: boolean; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
        active
          ? "bg-white text-[#8A3FFC] shadow-sm"
          : "text-white/75 hover:bg-white/10 hover:text-white",
      )}
    >
      <span className="flex items-center gap-3">
        <Icon size={18} className={cn(active && "text-[#8A3FFC]")} />
        <span className={cn(active && "font-semibold")}>{label}</span>
      </span>
      {badge ? (
        <span className="min-w-[16px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-black text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function profileMenuData(user: AuthUser) {
  return {
    fullName: user.creator?.full_name || user.company?.name || user.name,
    artisticName: user.creator?.artistic_name,
    photoUrl: user.creator?.photo_url || user.company?.logo_url || user.avatar_url,
    email: user.email,
    phone: user.creator?.whatsapp || user.company?.whatsapp || undefined,
    instagram: user.creator?.socials?.instagram,
    city: user.creator?.city || user.company?.city || undefined,
    state: user.creator?.state || undefined,
    country: user.creator?.country || user.company?.country || undefined,
  };
}

export function AppShell({ user, onUserChange, children }: { user: AuthUser; onUserChange: (user: AuthUser) => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const privacy = usePrivacy();
  const { t } = useTranslation("nav");
  const { t: tc } = useTranslation("common");
  const { t: tp } = useTranslation("profile");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pendingCampaigns, setPendingCampaigns] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const needsContract = user.role === "creator" && Boolean(user.creator?.id) && !user.creator?.contract_acceptance;
  const close = () => setOpen(false);
  const handle = (user.email.split("@")[0] || "admin").toUpperCase();
  const creatorProfileBase = user.creator?.id ? `/creators/${user.creator.id}` : null;
  const home = user.role === "admin"
    ? "/dashboard"
    : user.role === "company"
      ? "/company-dashboard"
      : creatorProfileBase
        ? `${creatorProfileBase}?tab=dashboard`
        : "/creator-dashboard";

  useEffect(() => {
    api.notifications("?unread=1").then((res) => setUnread(res.data.length)).catch(() => undefined);
    if (user.role === "admin") {
      api.dashboard().then((stats) => setPendingCampaigns(stats.pending_applications ?? 0)).catch(() => undefined);
    }
  }, [user.role, pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function logout() {
    await logoutRequest();
    router.push("/login");
  }

  const path = normalizePath(pathname);
  const isActive = (href: string) => {
    const target = normalizePath(href.split("?")[0] || href);
    return path === target || path.startsWith(`${target}/`);
  };
  const creatorTab = searchParams.get("tab");
  const creatorProfilePath = creatorProfileBase ? normalizePath(creatorProfileBase) : null;
  const onCreatorProfile = Boolean(creatorProfilePath && path === creatorProfilePath);
  const isCreatorHomeActive = onCreatorProfile && (creatorTab === "dashboard" || !creatorTab);
  const isCreatorCampaignsActive = onCreatorProfile && creatorTab === "campaigns";
  const isCreatorRecurringActive = onCreatorProfile && creatorTab === "recurring"
    || isActive("/recurring");
  const isCreatorPortfolioActive = onCreatorProfile && creatorTab === "portfolio";
  const isCreatorProfileActive = onCreatorProfile && creatorTab === "about";
  const isAvailableCampaignsActive = isActive("/available-campaigns");
  const isNotificationsActive = isActive("/notifications");
  const isJoinActive = isActive("/join");

  const primaryNav: (NavItem & { active: boolean })[] = user.role === "admin"
    ? [
        { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, active: isActive("/dashboard") || path === "/" },
        { href: "/creators", label: t("creators"), icon: Users, active: isActive("/creators") },
        { href: "/campaigns", label: t("campaigns"), icon: Megaphone, active: isActive("/campaigns"), badge: pendingCampaigns },
        { href: "/recurring", label: t("tabRecurring"), icon: Repeat, active: isActive("/recurring") },
      ]
    : user.role === "company"
      ? [
          { href: "/company-dashboard", label: t("tabPanel"), icon: Building2, active: isActive("/company-dashboard") },
          { href: "/creators", label: t("creators"), icon: Users, active: isActive("/creators") },
          { href: "/campaigns", label: t("campaigns"), icon: Megaphone, active: isActive("/campaigns") },
          { href: "/recurring", label: t("tabRecurring"), icon: Repeat, active: isActive("/recurring") },
        ]
      : [
          { href: home, label: t("tabHome"), icon: Home, active: isCreatorHomeActive || isActive("/creator-dashboard") },
          { href: "/available-campaigns", label: t("tabAvailable"), icon: Sparkles, active: isAvailableCampaignsActive },
          { href: creatorProfileBase ? `${creatorProfileBase}?tab=campaigns` : "/campaigns", label: t("campaigns"), icon: Megaphone, active: isCreatorCampaignsActive },
          { href: creatorProfileBase ? `${creatorProfileBase}?tab=recurring` : "/recurring", label: t("tabRecurring"), icon: Repeat, active: isCreatorRecurringActive },
        ];
  const moreActive = !primaryNav.some((item) => item.active);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F9FAFB] font-sans">
      {open ? <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={close} /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[min(240px,86vw)] shrink-0 flex-col bg-[#8A3FFC] text-white/80 transition-transform lg:static lg:w-[240px] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mb-8 flex items-center justify-center px-2 py-2">
            <RocketzLogo variant="sidebar" size="md" href={home} />
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {user.role === "admin" ? (
              <>
                <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-white/55 uppercase">{t("agency")}</div>
                <SidebarItem href="/dashboard" label={t("dashboard")} icon={LayoutDashboard} active={isActive("/dashboard") || path === "/"} onClick={close} />
                <SidebarItem href="/creators" label={t("creators")} icon={Users} active={isActive("/creators")} onClick={close} />
                <SidebarItem href="/companies" label={t("companies")} icon={Building2} active={isActive("/companies")} onClick={close} />
                <SidebarItem href="/campaigns" label={t("campaigns")} icon={Megaphone} active={isActive("/campaigns")} badge={pendingCampaigns} onClick={close} />
                <SidebarItem href="/recurring" label={t("recurring")} icon={Repeat} active={isActive("/recurring")} onClick={close} />
                <SidebarItem href="/campaign-deliveries" label={t("deliveries")} icon={Video} active={isActive("/campaign-deliveries")} onClick={close} />
                <SidebarItem href="/notifications" label={t("notifications")} icon={Bell} active={isNotificationsActive} badge={unread} onClick={close} />
                {userHasPermission(user, "users.manage") ? (
                  <SidebarItem href="/users" label={t("users")} icon={ShieldCheck} active={isActive("/users") || isActive("/admin-users")} onClick={close} />
                ) : null}
                <div className="mt-6 border-t border-white/20 pt-6">
                  <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-white/55 uppercase">{t("shortcuts")}</div>
                  <SidebarItem href="/available-campaigns?view=creator" label={t("viewAsCreator")} icon={Sparkles} active={false} onClick={close} />
                  <SidebarItem href="/available-campaigns" label={t("availableCampaigns")} icon={Sparkles} active={isAvailableCampaignsActive} onClick={close} />
                  <SidebarItem href="/company-dashboard" label={t("companyPortal")} icon={Building2} active={isActive("/company-dashboard")} onClick={close} />
                  <SidebarItem href="/join" label={t("landing")} icon={Globe} active={isJoinActive} onClick={close} />
                </div>
              </>
            ) : user.role === "company" ? (
              <>
                <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-white/55 uppercase">{t("companyPanel")}</div>
                <SidebarItem href="/company-dashboard" label={t("campaignPanel")} icon={Building2} active={isActive("/company-dashboard")} onClick={close} />
                <SidebarItem href="/creators" label={t("creators")} icon={Users} active={isActive("/creators")} onClick={close} />
                <SidebarItem href="/campaigns" label={t("campaigns")} icon={Megaphone} active={isActive("/campaigns")} onClick={close} />
                <SidebarItem href="/available-campaigns" label={t("availableCampaigns")} icon={Sparkles} active={isAvailableCampaignsActive} onClick={close} />
                <SidebarItem href="/recurring" label={t("recurring")} icon={Repeat} active={isActive("/recurring")} onClick={close} />
                <SidebarItem href="/campaign-deliveries" label={t("deliveries")} icon={Video} active={isActive("/campaign-deliveries")} onClick={close} />
                <SidebarItem href="/notifications" label={t("notifications")} icon={Bell} active={isNotificationsActive} badge={unread} onClick={close} />
                <SidebarItem href="/join" label={t("viewLanding")} icon={Globe} active={isJoinActive} onClick={close} />
              </>
            ) : (
              <>
                <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-white/55 uppercase">{t("creatorPortal")}</div>
                <SidebarItem href={home} label={t("home")} icon={Home} active={isCreatorHomeActive || isActive("/creator-dashboard")} onClick={close} />
                <SidebarItem href="/available-campaigns" label={t("availableCampaigns")} icon={Sparkles} active={isAvailableCampaignsActive} onClick={close} />
                {creatorProfileBase ? <SidebarItem href={`${creatorProfileBase}?tab=campaigns`} label={t("myCampaigns")} icon={Megaphone} active={isCreatorCampaignsActive} onClick={close} /> : null}
                {creatorProfileBase ? (
                  <SidebarItem href={`${creatorProfileBase}?tab=recurring`} label={t("recurring")} icon={Repeat} active={isCreatorRecurringActive} onClick={close} />
                ) : (
                  <SidebarItem href="/recurring" label={t("recurring")} icon={Repeat} active={isActive("/recurring")} onClick={close} />
                )}
                {creatorProfileBase ? <SidebarItem href={`${creatorProfileBase}?tab=portfolio`} label={t("portfolio")} icon={Video} active={isCreatorPortfolioActive} onClick={close} /> : null}
                {creatorProfileBase ? <SidebarItem href={`${creatorProfileBase}?tab=about`} label={t("mediaKit")} icon={Sparkles} active={isCreatorProfileActive} onClick={close} /> : null}
                <SidebarItem href="/notifications" label={t("notifications")} icon={Bell} active={isNotificationsActive} badge={unread} onClick={close} />
                <SidebarItem href="/join" label={t("homeLanding")} icon={Globe} active={isJoinActive} onClick={close} />
              </>
            )}
          </nav>

          <div className="mt-auto space-y-2 border-t border-white/20 pt-4">
            <LanguageSwitcher theme="dark" layout="segmented" className="w-full justify-center" />
            <button
              type="button"
              onClick={privacy.openLgpd}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold tracking-wider text-emerald-200 uppercase hover:bg-white/10 hover:text-white"
            >
              <ShieldCheck size={16} className="shrink-0" />
              {t("lgpdPrivacy")}
            </button>
            <UserProfileMenu
              user={user}
              role={user.role}
              userData={profileMenuData(user)}
              onOpenEditProfile={() => setEditOpen(true)}
              onOpenLgpdModal={privacy.openLgpd}
              onOpenContractModal={() => setContractOpen(true)}
              onLogout={logout}
              variant="sidebar"
            />
          </div>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 flex h-[calc(3.5rem+env(safe-area-inset-top,0px))] shrink-0 items-center justify-between gap-2 overflow-visible border-b border-[#E2E8F0] bg-white px-3 pt-[env(safe-area-inset-top,0px)] sm:h-[calc(4rem+env(safe-area-inset-top,0px))] sm:px-6 lg:h-20 lg:px-10 lg:pt-0">
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl text-[#64748B] hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label={tc("openMenu")}>
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="lg:hidden">
              <RocketzLogo variant="light" size="sm" href={home} />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-hidden sm:gap-2 lg:gap-2.5">
            {user.role === "admin" ? (
              <div className="hidden min-w-0 max-w-[160px] shrink xl:block">
                <CreatorSwitcher handle={handle} />
              </div>
            ) : null}
            <Link
              href="/notifications"
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-brand-primary"
              title={t("notifications")}
            >
              <Bell size={18} className="shrink-0" />
              {unread > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                  {unread}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={privacy.toggleHideValues}
              title={privacy.hideValues ? t("hiddenValues") : t("hideValues")}
              className={cn(
                "flex h-11 max-w-full shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-extrabold whitespace-nowrap sm:px-3",
                privacy.hideValues
                  ? "border-amber-300 bg-amber-500/10 text-amber-700"
                  : "border-slate-200 bg-white text-slate-600",
              )}
            >
              {privacy.hideValues ? <EyeOff size={16} className="shrink-0 text-amber-600" /> : <Eye size={16} className="shrink-0 text-slate-500" />}
              <span className="hidden truncate lg:inline">{privacy.hideValues ? t("hiddenValues") : t("hideValues")}</span>
            </button>
            <button
              type="button"
              onClick={privacy.openLgpd}
              title={t("lgpd")}
              className="hidden h-11 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold whitespace-nowrap text-emerald-700 sm:inline-flex sm:px-3"
            >
              <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
              <span className="hidden sm:inline">{t("lgpd")}</span>
            </button>
            {user.role === "admin" ? (
              <>
                <div className="hidden h-5 w-px shrink-0 bg-slate-200 lg:block" />
                <button
                  type="button"
                  onClick={() => router.push("/creators?filters=true")}
                  className="hidden h-10 max-w-[140px] items-center truncate rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold whitespace-nowrap text-[#0F172A] lg:inline-flex"
                >
                  <span className="truncate">{t("advancedFilters")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/campaigns?new=true")}
                  className="hidden h-10 max-w-[160px] items-center gap-1 truncate rounded-lg bg-brand-primary px-3 text-xs font-semibold whitespace-nowrap text-white shadow-md shadow-indigo-200 lg:inline-flex"
                >
                  <span className="truncate">{t("newCampaign")}</span>
                </button>
              </>
            ) : null}
          </div>
          <UserProfileMenu
            user={user}
            role={user.role}
            userData={profileMenuData(user)}
            onOpenEditProfile={() => setEditOpen(true)}
            onOpenLgpdModal={privacy.openLgpd}
            onOpenContractModal={() => setContractOpen(true)}
            onLogout={logout}
            variant="header"
          />
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[calc(var(--app-bottom-nav-h)+0.75rem)] sm:p-6 sm:pb-[calc(var(--app-bottom-nav-h)+1rem)] lg:p-10 lg:pb-10">
          {needsContract ? (
            <div className="mb-4 sm:mb-6">
              <CreatorContractRequiredBanner onSign={() => setContractOpen(true)} />
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label={t("tabMore")}
      >
        <div className="grid h-[3.75rem] grid-cols-5">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-bold",
                  item.active ? "text-brand-primary" : "text-slate-500",
                )}
              >
                <Icon size={20} className="shrink-0" />
                <span className="max-w-full truncate">{item.label}</span>
                {item.badge ? (
                  <span className="absolute top-1 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={tc("moreMenu")}
            className={cn(
              "relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-bold",
              moreActive || open ? "text-brand-primary" : "text-slate-500",
            )}
          >
            <MoreHorizontal size={20} className="shrink-0" />
            <span>{t("tabMore")}</span>
            {unread > 0 && !primaryNav.some((item) => item.href === "/notifications") ? (
              <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-rose-500" />
            ) : null}
          </button>
        </div>
      </nav>
      <LgpdPrivacyModal />
      <LgpdBanner />
      <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} user={user} onProfileUpdated={onUserChange} />
      <CreatorContractModal
        isOpen={contractOpen}
        onClose={() => setContractOpen(false)}
        readOnly={user.role !== "creator" || !!user.creator?.contract_acceptance}
        existingAuditRecord={
          user.creator?.contract_acceptance
            ? {
                termId: `RC-${user.creator.contract_acceptance.id}`,
                version: "1.0 (2026)",
                fullName: user.creator.contract_acceptance.full_name,
                document: user.creator.document || "",
                email: user.email,
                acceptedAt: user.creator.contract_acceptance.accepted_at || "",
                formattedDate: user.creator.contract_acceptance.accepted_at
                  ? new Date(user.creator.contract_acceptance.accepted_at).toLocaleString("pt-BR")
                  : "",
                ipUserAgent: "",
                declarations: {},
                allAccepted: true,
                status: "valid",
              }
            : null
        }
        creatorName={user.creator?.full_name || user.name}
        creatorEmail={user.email}
        creatorDocument={user.creator?.document || ""}
        onAccept={async (audit) => {
          if (!user.creator?.id) {
            setContractOpen(false);
            return;
          }
          try {
            await api.acceptContract(user.creator.id, {
              full_name: audit.fullName,
              email: audit.email,
              document: audit.document,
            });
            const refreshed = await fetchMe();
            onUserChange(refreshed);
            window.dispatchEvent(new Event("rocketz:auth-refresh"));
            setContractOpen(false);
            await alertSuccess(tp("termAccepted"));
          } catch (err) {
            await alertApiError(err);
          }
        }}
      />
    </div>
  );
}
