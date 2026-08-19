"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Building2,
  Globe,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Repeat,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { RocketzLogo } from "@/components/RocketzLogo";
import { cn } from "@/lib/cn";
import type { AuthUser } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

function itemsFor(user: AuthUser): { title: string; items: NavItem[] } {
  if (user.role === "admin") {
    return {
      title: "Painel Agência",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/creators", label: "Criadores", icon: Users },
        { href: "/companies", label: "Empresas", icon: Building2 },
        { href: "/campaigns", label: "Campanhas", icon: Megaphone },
        { href: "/campaign-deliveries", label: "Entregas & Vídeos", icon: Video },
        { href: "/recurring", label: "Trabalhos Recorrentes", icon: Repeat },
        { href: "/notifications", label: "Notificações", icon: Bell },
        { href: "/join", label: "Landing Page", icon: Globe },
      ],
    };
  }

  if (user.role === "company") {
    return {
      title: "Painel da Empresa",
      items: [
        { href: "/company-dashboard", label: "Painel de Campanhas", icon: Building2 },
        { href: "/available-campaigns", label: "Campanhas Disponíveis", icon: Sparkles },
        { href: "/recurring", label: "Trabalhos Recorrentes", icon: Repeat },
        { href: "/campaign-deliveries", label: "Entregas & Vídeos", icon: Video },
        { href: "/notifications", label: "Notificações", icon: Bell },
        { href: "/join", label: "Ver Landing Page", icon: Globe },
      ],
    };
  }

  const profile = user.creator?.id ? `/creators/${user.creator.id}` : `/creators/${user.id}`;
  return {
    title: "Portal do Criador",
    items: [
      { href: profile, label: "Início / Central", icon: Home },
      { href: "/available-campaigns", label: "Campanhas Disponíveis", icon: Sparkles },
      { href: "/recurring", label: "Trabalhos Recorrentes", icon: Repeat },
      { href: "/notifications", label: "Notificações", icon: Bell },
      { href: "/join", label: "Landing Page", icon: Globe },
    ],
  };
}

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = itemsFor(user);

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F9FAFB] font-sans">
      {open ? <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[240px] shrink-0 flex-col bg-[#111827] text-[#94A3B8] transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col p-6">
          <div className="mb-8 flex justify-center py-1">
            <RocketzLogo variant="dark" size="md" href={user.role === "admin" ? "/dashboard" : nav.items[0]?.href} />
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto">
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{nav.title}</div>
            {nav.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active ? "bg-[#1F2937] text-[#F8FAFC]" : "text-[#94A3B8] hover:bg-white/5 hover:text-[#F8FAFC]",
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={logout}
            className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#94A3B8] hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <button className="rounded-lg p-2 text-slate-700 lg:hidden" onClick={() => setOpen(true)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="lg:hidden">
            <RocketzLogo variant="light" size="sm" href="/" showSubtitle={false} />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden font-semibold text-slate-700 sm:inline">{user.name}</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700">
              {user.role}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
