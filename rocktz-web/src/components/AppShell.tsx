"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Coins,
  Eye,
  EyeOff,
  Globe,
  Home,
  Landmark,
  Layers,
  LayoutDashboard,
  Mail,
  Megaphone,
  Menu,
  MoreHorizontal,
  Package,
  Repeat,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  TicketPercent,
  UserRound,
  Users,
  UsersRound,
  Video,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { CreatorSwitcher } from "@/components/CreatorSwitcher";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { CreatorContractModal } from "@/components/CreatorContractModal";
import { CreatorContractRequiredBanner } from "@/components/CreatorContractRequiredBanner";
import { CreatorFirstPortfolioBanner } from "@/components/CreatorFirstPortfolioBanner";
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
import { companyLandingPath } from "@/lib/landing-origin";
import { APP_VERSION } from "@/lib/app-version";
import { cacheNavBadges, isNavCacheFresh, peekNavBadges } from "@/lib/session-cache";
import { usePrivacy } from "@/lib/privacy";
import { useTranslation } from "react-i18next";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
  external?: boolean;
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
  external,
}: NavItem & { active: boolean; onClick: () => void }) {
  const className = cn(
    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium leading-none tracking-tight transition-all duration-200",
    active
      ? "bg-white text-[#8A3FFC] shadow-sm"
      : "text-white/80 hover:bg-white/10 hover:text-white",
  );
  const inner = (
    <>
      <Icon size={17} strokeWidth={1.85} className="shrink-0" />
      <span className={cn("min-w-0 flex-1 truncate", active && "font-semibold")} title={label}>
        {label}
      </span>
      {badge ? (
        <span className="min-w-[18px] shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
          {badge}
        </span>
      ) : null}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} className={className}>
      {inner}
    </Link>
  );
}

type SidebarLink = NavItem & { active: boolean };

type SidebarSection = {
  id: string;
  label: string;
  icon: typeof Home;
  items: SidebarLink[];
};

function sidebarSection(
  id: string,
  label: string,
  icon: typeof Home,
  items: Array<SidebarLink | false | null | undefined>,
): SidebarSection | null {
  const visible = items.filter((item): item is SidebarLink => Boolean(item));
  return visible.length > 0 ? { id, label, icon, items: visible } : null;
}

function readStoredNavGroups(role: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`rocketz:nav-groups:${role}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function SidebarGroup({
  id,
  label,
  icon: Icon,
  items,
  open,
  onToggle,
  onNavigate,
}: SidebarSection & { open: boolean; onToggle: () => void; onNavigate: () => void }) {
  const badge = items.reduce((sum, item) => sum + (item.badge ?? 0), 0);
  const hasActive = items.some((item) => item.active);
  const panelId = `nav-group-${id}`;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-bold tracking-wider uppercase transition-colors",
          hasActive ? "text-white" : "text-white/55 hover:bg-white/10 hover:text-white",
          hasActive && !open && "bg-white/10 text-white",
        )}
      >
        <Icon size={15} strokeWidth={1.85} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={label}>{label}</span>
        {!open && badge > 0 ? (
          <span className="min-w-[18px] shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
            {badge > 999 ? "999+" : badge}
          </span>
        ) : null}
        <ChevronDown
          size={14}
          strokeWidth={2.25}
          className={cn("shrink-0 text-white/55 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={label}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className={cn("min-h-0 overflow-hidden", !open && "pointer-events-none")} inert={!open}>
          <div className="mt-0.5 ml-3 space-y-0.5 border-l border-white/15 py-0.5 pl-1.5">
            {items.map((item) => (
              <SidebarItem key={item.href} {...item} onClick={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
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
  const [hasRecurring, setHasRecurring] = useState<boolean | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [companyPublicLandingSlug, setCompanyPublicLandingSlug] = useState<string | null>(null);
  const needsContract = user.role === "creator" && Boolean(user.creator?.id) && !user.creator?.contract_acceptance;
  const needsFirstPortfolio = user.role === "creator" && Boolean(user.creator?.id) && (user.creator?.portfolio_count ?? 0) < 1;
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
    let cancelled = false;

    function apply(badges: { unread: number; pending_applications: number; has_recurring?: boolean }) {
      setUnread(badges.unread);
      setPendingCampaigns(user.role === "admin" ? badges.pending_applications : 0);
      if (typeof badges.has_recurring === "boolean") setHasRecurring(badges.has_recurring);
    }

    const cached = peekNavBadges();
    if (cached) apply(cached);

    async function loadBadges(force = false) {
      if (!force && isNavCacheFresh() && peekNavBadges()) return;
      try {
        const badges = await api.nav();
        if (cancelled) return;
        cacheNavBadges(badges);
        apply(badges);
      } catch {
        /* ignore */
      }
    }

    void loadBadges(true);
    const timer = window.setInterval(() => {
      void loadBadges();
    }, 60_000);

    function onNavRefresh() {
      void loadBadges();
    }
    window.addEventListener("rocketz:nav-refresh", onNavRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("rocketz:nav-refresh", onNavRefresh);
    };
  }, [user.role, user.company?.id]);

  useEffect(() => {
    if (user.role !== "company" || !user.company?.id) {
      setCompanyPublicLandingSlug(null);
      return;
    }

    let cancelled = false;
    const companyId = user.company.id;

    api.companyLanding(companyId)
      .then((res) => {
        if (cancelled) return;
        const page = res.data;
        setCompanyPublicLandingSlug(page.status === "published" && page.slug ? page.slug : null);
      })
      .catch(() => {
        if (!cancelled) setCompanyPublicLandingSlug(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user.role, user.company?.id, pathname]);

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
  const isCreatorStorefrontActive = onCreatorProfile && creatorTab === "storefront";
  const isCreatorStorefrontMetricsActive = onCreatorProfile && (creatorTab === "storefront-metrics" || path.includes("/storefront-metrics"));
  const isCreatorProfileActive = onCreatorProfile && creatorTab === "about";
  const isCreatorShippingActive = onCreatorProfile && creatorTab === "shipping";
  const isCreatorBankActive = onCreatorProfile && creatorTab === "bank";
  const showRecurringNav = user.role === "admin" || hasRecurring === true;
  const showFinanceNav = user.role !== "admin" || userHasPermission(user, "finance.access");
  const isAvailableCampaignsActive = isActive("/available-campaigns");
  const isNotificationsActive = isActive("/notifications");
  const isJoinActive = isActive("/join");

  const primaryNav: (NavItem & { active: boolean })[] = user.role === "admin"
    ? [
        { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, active: isActive("/dashboard") || path === "/" },
        { href: "/creators", label: t("creators"), icon: Users, active: isActive("/creators") },
        { href: "/campaigns", label: t("campaigns"), icon: Megaphone, active: isActive("/campaigns"), badge: pendingCampaigns },
        { href: "/coupons", label: t("coupons"), icon: TicketPercent, active: isActive("/coupons") },
        ...(showFinanceNav ? [{ href: "/finance", label: t("finance"), icon: Wallet, active: isActive("/finance") }] : []),
        ...(showRecurringNav ? [{ href: "/recurring", label: t("tabRecurring"), icon: Repeat, active: isActive("/recurring") }] : []),
      ]
    : user.role === "company"
      ? [
          { href: "/company-dashboard", label: t("tabHome"), icon: Home, active: isActive("/company-dashboard") },
          { href: "/creators", label: t("creators"), icon: Users, active: isActive("/creators") },
          { href: "/campaigns", label: t("campaigns"), icon: Megaphone, active: isActive("/campaigns") },
          { href: "/coupons", label: t("coupons"), icon: TicketPercent, active: isActive("/coupons") },
          { href: "/finance", label: t("finance"), icon: Wallet, active: isActive("/finance") },
          ...(showRecurringNav ? [{ href: "/recurring", label: t("tabRecurring"), icon: Repeat, active: isActive("/recurring") }] : []),
        ]
      : [
          { href: home, label: t("tabHome"), icon: Home, active: isCreatorHomeActive || isActive("/creator-dashboard") },
          { href: "/available-campaigns", label: t("tabAvailable"), icon: Sparkles, active: isAvailableCampaignsActive },
          { href: creatorProfileBase ? `${creatorProfileBase}?tab=campaigns` : "/campaigns", label: t("campaigns"), icon: Megaphone, active: isCreatorCampaignsActive },
          { href: "/coupons", label: t("myCoupons"), icon: TicketPercent, active: isActive("/coupons") },
          { href: "/finance", label: t("myFinance"), icon: Wallet, active: isActive("/finance") },
          ...(showRecurringNav ? [{ href: creatorProfileBase ? `${creatorProfileBase}?tab=recurring` : "/recurring", label: t("tabRecurring"), icon: Repeat, active: isCreatorRecurringActive }] : []),
        ];
  const moreActive = !primaryNav.some((item) => item.active) && !isCreatorShippingActive && !isCreatorBankActive;

  const pinnedNav: SidebarLink[] = user.role === "admin"
    ? [{ href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, active: isActive("/dashboard") || path === "/" }]
    : user.role === "company"
      ? [{ href: "/company-dashboard", label: t("home"), icon: Home, active: isActive("/company-dashboard") }]
      : [{ href: home, label: t("home"), icon: Home, active: isCreatorHomeActive || isActive("/creator-dashboard") }];

  const navSections = (
    user.role === "admin"
      ? [
          sidebarSection("people", t("groupPeople"), Users, [
            { href: "/creators", label: t("creators"), icon: Users, active: isActive("/creators") },
            { href: "/creator-groups", label: t("creatorGroups"), icon: UsersRound, active: isActive("/creator-groups") },
            { href: "/companies", label: t("companies"), icon: Building2, active: isActive("/companies") },
          ]),
          sidebarSection("content", t("groupContent"), Layers, [
            { href: "/campaigns", label: t("campaigns"), icon: Megaphone, active: isActive("/campaigns"), badge: pendingCampaigns },
            showRecurringNav ? { href: "/recurring", label: t("recurring"), icon: Repeat, active: isActive("/recurring") } : null,
            { href: "/campaign-deliveries", label: t("deliveries"), icon: Video, active: isActive("/campaign-deliveries") },
            { href: "/calendar", label: t("postingAgenda"), icon: CalendarDays, active: isActive("/calendar") },
          ]),
          sidebarSection("finance", t("groupFinance"), CircleDollarSign, [
            { href: "/coupons", label: t("coupons"), icon: TicketPercent, active: isActive("/coupons") },
            { href: "/coupon-earnings", label: t("couponEarnings"), icon: Coins, active: isActive("/coupon-earnings") },
            showFinanceNav ? { href: "/finance", label: t("finance"), icon: Wallet, active: isActive("/finance") } : null,
          ]),
          sidebarSection("admin", t("groupAdmin"), Settings2, [
            { href: "/notifications", label: t("notifications"), icon: Bell, active: isNotificationsActive, badge: unread },
            userHasPermission(user, "mail.manage") ? { href: "/mail", label: t("mailTemplates"), icon: Mail, active: isActive("/mail") && !isActive("/mail/log") } : null,
            userHasPermission(user, "mail.manage") ? { href: "/mail/log", label: t("mailLog"), icon: Mail, active: isActive("/mail/log") } : null,
            userHasPermission(user, "logs.view") ? { href: "/logs", label: t("activityLogs"), icon: ScrollText, active: isActive("/logs") } : null,
            userHasPermission(user, "users.manage") ? { href: "/users", label: t("users"), icon: ShieldCheck, active: isActive("/users") || isActive("/admin-users") } : null,
            { href: "/settings/storefront", label: t("storefrontSettings"), icon: Store, active: isActive("/settings/storefront") },
          ]),
          sidebarSection("shortcuts", t("groupShortcuts"), Zap, [
            { href: "/available-campaigns?view=creator", label: t("viewAsCreator"), icon: Sparkles, active: false },
            { href: "/available-campaigns", label: t("availableCampaigns"), icon: Sparkles, active: isAvailableCampaignsActive },
            { href: "/company-dashboard", label: t("companyPortal"), icon: Building2, active: isActive("/company-dashboard") },
            { href: "/join", label: t("landing"), icon: Globe, active: isJoinActive },
          ]),
        ]
      : user.role === "company"
        ? [
            sidebarSection("people", t("groupPeople"), Users, [
              { href: "/creators", label: t("creators"), icon: Users, active: isActive("/creators") },
              { href: "/creator-groups", label: t("creatorGroups"), icon: UsersRound, active: isActive("/creator-groups") },
            ]),
            sidebarSection("content", t("groupContent"), Layers, [
              { href: "/campaigns", label: t("campaigns"), icon: Megaphone, active: isActive("/campaigns") },
              showRecurringNav ? { href: "/recurring", label: t("recurring"), icon: Repeat, active: isActive("/recurring") } : null,
              { href: "/campaign-deliveries", label: t("deliveries"), icon: Video, active: isActive("/campaign-deliveries") },
              { href: "/calendar", label: t("postingAgenda"), icon: CalendarDays, active: isActive("/calendar") },
            ]),
            sidebarSection("finance", t("groupFinance"), CircleDollarSign, [
              { href: "/coupons", label: t("coupons"), icon: TicketPercent, active: isActive("/coupons") },
              { href: "/coupon-earnings", label: t("couponEarnings"), icon: Coins, active: isActive("/coupon-earnings") },
              { href: "/finance", label: t("finance"), icon: Wallet, active: isActive("/finance") },
            ]),
            sidebarSection("admin", t("groupAdmin"), Settings2, [
              { href: "/notifications", label: t("notifications"), icon: Bell, active: isNotificationsActive, badge: unread },
              { href: "/company-landing", label: t("myLanding"), icon: Globe, active: isActive("/company-landing") },
              companyPublicLandingSlug
                ? {
                    href: companyLandingPath(companyPublicLandingSlug),
                    label: t("viewLanding"),
                    icon: Globe,
                    active: false,
                    external: true,
                  }
                : null,
            ]),
          ]
        : [
            sidebarSection("content", t("groupContent"), Layers, [
              { href: "/available-campaigns", label: t("availableCampaigns"), icon: Sparkles, active: isAvailableCampaignsActive },
              creatorProfileBase ? { href: `${creatorProfileBase}?tab=campaigns`, label: t("myCampaigns"), icon: Megaphone, active: isCreatorCampaignsActive } : null,
              showRecurringNav && creatorProfileBase
                ? { href: `${creatorProfileBase}?tab=recurring`, label: t("recurring"), icon: Repeat, active: isCreatorRecurringActive }
                : null,
              showRecurringNav && !creatorProfileBase
                ? { href: "/recurring", label: t("recurring"), icon: Repeat, active: isActive("/recurring") }
                : null,
              { href: "/calendar", label: t("calendar"), icon: CalendarDays, active: isActive("/calendar") },
              creatorProfileBase ? { href: `${creatorProfileBase}?tab=portfolio`, label: t("portfolio"), icon: Video, active: isCreatorPortfolioActive } : null,
              creatorProfileBase ? { href: `${creatorProfileBase}?tab=storefront`, label: t("storefront"), icon: Store, active: isCreatorStorefrontActive } : null,
              creatorProfileBase ? { href: `${creatorProfileBase}?tab=storefront-metrics`, label: t("storefrontMetrics"), icon: BarChart3, active: isCreatorStorefrontMetricsActive } : null,
              creatorProfileBase ? { href: `${creatorProfileBase}?tab=about`, label: t("mediaKit"), icon: Sparkles, active: isCreatorProfileActive } : null,
            ]),
            sidebarSection("finance", t("groupFinance"), CircleDollarSign, [
              { href: "/coupons", label: t("myCoupons"), icon: TicketPercent, active: isActive("/coupons") },
              { href: "/finance", label: t("myFinance"), icon: Wallet, active: isActive("/finance") },
              creatorProfileBase ? { href: `${creatorProfileBase}?tab=bank`, label: t("bankAccount"), icon: Landmark, active: isCreatorBankActive } : null,
            ]),
            sidebarSection("account", t("groupAccount"), UserRound, [
              creatorProfileBase ? { href: `${creatorProfileBase}?tab=shipping`, label: t("shippingAddress"), icon: Package, active: isCreatorShippingActive } : null,
              { href: "/notifications", label: t("notifications"), icon: Bell, active: isNotificationsActive, badge: unread },
            ]),
          ]
  ).filter((section): section is SidebarSection => section !== null);

  const activeGroupId = navSections.find((section) => section.items.some((item) => item.active))?.id ?? null;
  const activeGroupIdRef = useRef<string | null>(null);
  activeGroupIdRef.current = activeGroupId;
  const [openGroups, setOpenGroups] = useState<string[] | null>(null);
  const searchKey = searchParams.toString();

  useEffect(() => {
    const stored = readStoredNavGroups(user.role);
    const next = new Set(stored);
    if (activeGroupIdRef.current) next.add(activeGroupIdRef.current);
    setOpenGroups([...next]);
  }, [user.role]);

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((prev) => {
      if (!prev || prev.includes(activeGroupId)) return prev;
      return [...prev, activeGroupId];
    });
  }, [activeGroupId, pathname, searchKey]);

  useEffect(() => {
    if (!openGroups) return;
    try {
      window.localStorage.setItem(`rocketz:nav-groups:${user.role}`, JSON.stringify(openGroups));
    } catch {
      /* ignore */
    }
  }, [openGroups, user.role]);

  const openIds = openGroups ?? (activeGroupId ? [activeGroupId] : []);

  function toggleNavGroup(id: string) {
    setOpenGroups((prev) => {
      const current = prev ?? openIds;
      return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    });
  }

  const panelLabel = user.role === "admin" ? t("agency") : user.role === "company" ? t("companyPanel") : t("creatorPortal");

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F9FAFB] font-sans">
      {open ? <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={close} /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[min(16.75rem,86vw)] shrink-0 flex-col bg-[#8A3FFC] text-white/80 transition-transform lg:static lg:z-10 lg:w-[16.75rem] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col px-3.5 py-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-6 flex items-center justify-center px-1 py-1">
            <RocketzLogo variant="sidebar" size="md" href={home} />
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-label={panelLabel}>
            <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-white/55 uppercase">{panelLabel}</div>
            {pinnedNav.map((item) => (
              <SidebarItem key={item.href} {...item} onClick={close} />
            ))}
            <div className="mt-2 space-y-1">
              {navSections.map((section) => (
                <div key={section.id} className={cn(section.id === "shortcuts" && "mt-2 border-t border-white/15 pt-2")}>
                  <SidebarGroup
                    {...section}
                    open={openIds.includes(section.id)}
                    onToggle={() => toggleNavGroup(section.id)}
                    onNavigate={close}
                  />
                </div>
              ))}
            </div>
          </nav>

          <div className="mt-auto space-y-2 border-t border-white/20 pt-4">
            <LanguageSwitcher theme="dark" layout="segmented" className="w-full justify-center" />
            <button
              type="button"
              onClick={privacy.openLgpd}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[11px] font-bold tracking-wider whitespace-nowrap text-emerald-200 uppercase hover:bg-white/10 hover:text-white"
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
            <p className="px-1 pt-1 text-center text-[10px] font-medium tracking-wide text-white/45">
              {t("appVersion", { version: APP_VERSION })}
            </p>
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
            <CompanySwitcher user={user} onUserChange={onUserChange} />
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
        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-3 pb-[calc(var(--app-bottom-nav-h)+0.75rem)] sm:p-6 sm:pb-[calc(var(--app-bottom-nav-h)+1rem)] lg:p-10 lg:pb-10">
          {needsContract || needsFirstPortfolio ? (
            <div className="mb-4 flex flex-col gap-3 sm:mb-6">
              {needsContract ? <CreatorContractRequiredBanner onSign={() => setContractOpen(true)} /> : null}
              {needsFirstPortfolio && creatorProfileBase ? (
                <CreatorFirstPortfolioBanner href={`${creatorProfileBase}?tab=portfolio`} />
              ) : null}
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
        <div className="grid h-[3.75rem]" style={{ gridTemplateColumns: `repeat(${primaryNav.length + 1}, minmax(0, 1fr))` }}>
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
        creatorCountry={user.creator?.country}
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
