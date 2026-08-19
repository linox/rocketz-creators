"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Repeat,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { CreatorSwitcher } from "@/components/CreatorSwitcher";
import { CreatorContractModal } from "@/components/CreatorContractModal";
import { EditProfileModal } from "@/components/EditProfileModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LgpdBanner } from "@/components/LgpdBanner";
import { LgpdPrivacyModal } from "@/components/LgpdPrivacyModal";
import { RocketzLogo } from "@/components/RocketzLogo";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { logoutRequest } from "@/lib/laravel";
import { usePrivacy } from "@/lib/privacy";
import { useTranslation } from "react-i18next";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
};

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
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active ? "bg-[#1F2937] text-[#F8FAFC]" : "text-[#94A3B8] hover:bg-white/5 hover:text-[#F8FAFC]",
      )}
    >
      <span className="flex items-center gap-3">
        <Icon size={18} />
        {label}
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
  };
}

export function AppShell({ user, onUserChange, children }: { user: AuthUser; onUserChange: (user: AuthUser) => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const privacy = usePrivacy();
  const { t } = useTranslation("nav");
  const { t: tc } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pendingCampaigns, setPendingCampaigns] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const close = () => setOpen(false);
  const handle = (user.email.split("@")[0] || "admin").toUpperCase();
  const home = user.role === "admin" ? "/dashboard" : user.role === "company" ? "/company-dashboard" : "/creator-dashboard";

  useEffect(() => {
    api.notifications("?unread=1").then((res) => setUnread(res.data.length)).catch(() => undefined);
    if (user.role === "admin") {
      api.dashboard().then((stats) => setPendingCampaigns(stats.pending_applications ?? 0)).catch(() => undefined);
    }
  }, [user.role, pathname]);

  async function logout() {
    await logoutRequest();
    router.push("/login");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F9FAFB] font-sans">
      {open ? <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={close} /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[240px] shrink-0 flex-col bg-[#111827] text-[#94A3B8] transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col p-6">
          <div className="mb-8 flex justify-center py-1">
            <RocketzLogo variant="dark" size="md" href={home} />
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {user.role === "admin" ? (
              <>
                <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("agency")}</div>
                <SidebarItem href="/dashboard" label={t("dashboard")} icon={LayoutDashboard} active={isActive("/dashboard") || pathname === "/"} onClick={close} />
                <SidebarItem href="/creators" label={t("creators")} icon={Users} active={isActive("/creators")} onClick={close} />
                <SidebarItem href="/companies" label={t("companies")} icon={Building2} active={isActive("/companies")} onClick={close} />
                <SidebarItem href="/campaigns" label={t("campaigns")} icon={Megaphone} active={isActive("/campaigns")} badge={pendingCampaigns} onClick={close} />
                <SidebarItem href="/campaign-deliveries" label={t("deliveries")} icon={Video} active={pathname === "/campaign-deliveries"} onClick={close} />
                <SidebarItem href="/recurring" label={t("recurring")} icon={Repeat} active={isActive("/recurring")} onClick={close} />
                <SidebarItem href="/notifications" label={t("notifications")} icon={Bell} active={isActive("/notifications")} badge={unread} onClick={close} />
                <SidebarItem href="/admin-users" label={t("adminUsers")} icon={ShieldCheck} active={isActive("/admin-users")} onClick={close} />
                <div className="mt-6 border-t border-[#1E293B] pt-6">
                  <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("shortcuts")}</div>
                  <SidebarItem href="/available-campaigns?view=creator" label={t("viewAsCreator")} icon={Sparkles} active={false} onClick={close} />
                  <SidebarItem href="/available-campaigns" label={t("availableCampaigns")} icon={Sparkles} active={isActive("/available-campaigns")} onClick={close} />
                  <SidebarItem href="/company-dashboard" label={t("companyPortal")} icon={Building2} active={isActive("/company-dashboard")} onClick={close} />
                  <SidebarItem href="/join" label={t("landing")} icon={Globe} active={isActive("/join")} onClick={close} />
                </div>
              </>
            ) : user.role === "company" ? (
              <>
                <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("companyPanel")}</div>
                <SidebarItem href="/company-dashboard" label={t("campaignPanel")} icon={Building2} active={isActive("/company-dashboard")} onClick={close} />
                <SidebarItem href="/available-campaigns" label={t("availableCampaigns")} icon={Sparkles} active={isActive("/available-campaigns")} onClick={close} />
                <SidebarItem href="/recurring" label={t("recurring")} icon={Repeat} active={isActive("/recurring")} onClick={close} />
                <SidebarItem href="/campaign-deliveries" label={t("deliveries")} icon={Video} active={isActive("/campaign-deliveries")} onClick={close} />
                <SidebarItem href="/notifications" label={t("notifications")} icon={Bell} active={isActive("/notifications")} badge={unread} onClick={close} />
                <SidebarItem href="/join" label={t("viewLanding")} icon={Globe} active={isActive("/join")} onClick={close} />
              </>
            ) : (
              <>
                <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("creatorPortal")}</div>
                <SidebarItem href="/creator-dashboard" label={t("home")} icon={Home} active={isActive("/creator-dashboard")} onClick={close} />
                <SidebarItem href="/available-campaigns" label={t("availableCampaigns")} icon={Sparkles} active={isActive("/available-campaigns")} onClick={close} />
                {user.creator?.id ? <SidebarItem href={`/creators/${user.creator.id}`} label={t("myCampaigns")} icon={Megaphone} active={isActive(`/creators/${user.creator.id}`)} onClick={close} /> : null}
                <SidebarItem href="/recurring" label={t("recurring")} icon={Repeat} active={isActive("/recurring")} onClick={close} />
                {user.creator?.id ? <SidebarItem href={`/creators/${user.creator.id}`} label={t("portfolio")} icon={Video} active={false} onClick={close} /> : null}
                {user.creator?.id ? <SidebarItem href={`/creators/${user.creator.id}`} label={t("mediaKit")} icon={Sparkles} active={false} onClick={close} /> : null}
                <SidebarItem href="/notifications" label={t("notifications")} icon={Bell} active={isActive("/notifications")} badge={unread} onClick={close} />
                <SidebarItem href="/join" label={t("homeLanding")} icon={Globe} active={isActive("/join")} onClick={close} />
              </>
            )}
          </nav>

          <div className="mt-auto space-y-2 border-t border-[#334155] pt-4">
            <LanguageSwitcher theme="dark" className="w-full justify-center" />
            <button
              type="button"
              onClick={privacy.openLgpd}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold tracking-wider text-emerald-400 uppercase hover:bg-emerald-500/10 hover:text-emerald-300"
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
        <header className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-3 sm:h-20 sm:px-6 lg:px-10">
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" className="rounded-lg p-2 text-[#64748B] hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label={tc("openMenu")}>
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="lg:hidden">
              <RocketzLogo variant="light" size="sm" href={home} showSubtitle={false} />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2.5 lg:gap-3">
            <Link
              href="/join"
              className="hidden h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold tracking-wider text-slate-600 uppercase xl:flex"
            >
              <Globe size={14} />
              {t("viewLanding")}
            </Link>
            {user.role === "admin" ? (
              <>
                <div className="hidden xl:block">
                  <CreatorSwitcher handle={handle} />
                </div>
                <Link
                  href="/available-campaigns"
                  className="hidden h-10 shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold tracking-wider text-indigo-600 uppercase shadow-sm xl:flex"
                >
                  <Sparkles size={14} />
                  {t("creatorPortal")}
                </Link>
              </>
            ) : null}
            <Link href="/notifications" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-brand-primary" title={t("notifications")}>
              <Bell size={18} />
              {unread > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                  {unread}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={privacy.toggleHideValues}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-extrabold sm:px-3",
                privacy.hideValues
                  ? "border-amber-300 bg-amber-500/10 text-amber-700"
                  : "border-slate-200 bg-white text-slate-600",
              )}
            >
              {privacy.hideValues ? <EyeOff size={16} className="text-amber-600" /> : <Eye size={16} className="text-slate-500" />}
              <span className="hidden md:inline">{privacy.hideValues ? t("hiddenValues") : t("hideValues")}</span>
            </button>
            <button
              type="button"
              onClick={privacy.openLgpd}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold text-emerald-700 sm:px-3"
            >
              <ShieldCheck size={16} className="text-emerald-600" />
              <span className="hidden md:inline">{t("lgpd")}</span>
            </button>
            {user.role === "admin" ? (
              <>
                <div className="hidden h-5 w-px shrink-0 bg-slate-200 lg:block" />
                <button type="button" onClick={() => router.push("/creators?filters=true")} className="hidden rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] lg:inline-flex">
                  {t("advancedFilters")}
                </button>
                <button type="button" onClick={() => router.push("/campaigns?new=true")} className="hidden rounded-lg bg-brand-primary px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-200 lg:inline-flex">
                  {t("newCampaign")}
                </button>
              </>
            ) : null}
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
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-36 lg:p-10">{children}</main>
      </div>
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
            setContractOpen(false);
          } catch (err) {
            await alertApiError(err);
          }
        }}
      />
    </div>
  );
}
