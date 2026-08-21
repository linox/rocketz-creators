"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CheckCircle2, FileText, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import { usePrivacy } from "@/lib/privacy";
import type { DashboardStats } from "@/lib/types";

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-2 rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5"
    >
      <span className="text-[12px] font-semibold tracking-[0.05em] text-[#64748B] uppercase">{label}</span>
      <span className="text-[24px] font-bold text-[#0F172A]">{value}</span>
    </motion.div>
  );
}

function AdminDashboard({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation("app");
  const { formatCurrency, formatNumber } = usePrivacy();
  const revenue = stats.revenue ?? [];
  const emptyChart = !revenue.length || revenue.every((row) => !row.value);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="m-0 text-xl font-bold text-[#0F172A] sm:text-[28px]">{t("dash.title")}</h1>
        <p className="mt-1 text-[14px] text-[#64748B]">{t("dash.subtitle")}</p>
      </header>

      {(stats.pending_approval_creators ?? 0) > 0 ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 p-4 shadow-xs sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Users size={20} />
            </div>
            <div>
              <h4 className="m-0 flex items-center gap-2 text-sm font-bold text-amber-950">
                {stats.pending_approval_creators} {(stats.pending_approval_creators ?? 0) === 1 ? t("dash.pendingOne") : t("dash.pendingMany")}
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase">{t("dash.newSignup")}</span>
              </h4>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                {t("dash.pendingHint")}
              </p>
            </div>
          </div>
          <Link href="/creators?status=review" className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 sm:w-auto">
            {t("dash.reviewCreators")}
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        <KpiCard label={t("dash.kpiCasting")} value={formatNumber(stats.total_creators)} />
        <KpiCard label={t("dash.kpiCampaigns")} value={stats.running_campaigns ?? 0} />
        <KpiCard label={t("dash.kpiBudget")} value={formatCurrency(stats.total_campaign_value)} />
        <KpiCard label={t("dash.kpiSignatures")} value={String(stats.pending_signatures ?? 0).padStart(2, "0")} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
            <h2 className="text-[16px] font-bold text-[#0F172A]">{t("dash.revenue")}</h2>
            <span className="text-[12px] font-bold text-brand-primary">{t("dash.monthly")}</span>
          </div>
          <div className="h-[220px] w-full p-3 sm:h-[320px] sm:p-6">
            {emptyChart ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <TrendingUp size={28} className="animate-pulse text-slate-300" />
                <span className="text-xs font-bold text-slate-700">{t("dash.emptyChart")}</span>
                <span className="max-w-xs text-[11px] text-[#64748B]">{t("dash.emptyChartHint")}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `R$ ${formatNumber(Number(val))}`} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), t("dash.budget")]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-[16px] font-bold text-[#0F172A]">{t("dash.contracts")}</h2>
              <span className="rounded-full bg-[#6366F1]/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand-primary uppercase">{t("dash.members")}</span>
            </div>
            <div className="flex flex-col gap-4 p-6">
              {(stats.signatures ?? []).map((sig) => (
                <div key={sig.id} className="flex items-center justify-between border-b border-dashed border-[#F1F5F9] pb-2 text-[13px] last:border-none last:pb-0">
                  <div className="flex flex-col">
                    <strong className="text-[#0F172A]">{sig.creator_name || `@${sig.creator_artistic}`}</strong>
                    <span className="max-w-[150px] truncate text-[11px] text-[#64748B]">{sig.campaign_name}</span>
                  </div>
                  {sig.status === "signed" ? (
                    <span className="rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#15803D] uppercase">{t("dash.signed")}</span>
                  ) : sig.status === "sent" ? (
                    <span className="animate-pulse rounded-md bg-indigo-50 px-2 py-0.5 text-[9px] font-bold tracking-wider text-brand-primary uppercase">{t("dash.sent")}</span>
                  ) : (
                    <span className="rounded-md bg-[#FEF9C3] px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#A16207] uppercase">{t("dash.pending")}</span>
                  )}
                </div>
              ))}
              {!stats.signatures?.length ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-[12px] text-[#64748B]">
                  <FileText className="text-slate-300" size={24} />
                  <span>{t("dash.noCreatorsLinked")}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm">
            <div className="border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-[16px] font-bold text-[#0F172A]">{t("dash.upcoming", { count: stats.upcoming_deliveries ?? 0 })}</h2>
            </div>
            <div className="flex flex-col gap-4 p-6">
              {(stats.deliveries ?? []).map((delivery) => (
                <div key={delivery.id} className="flex items-center gap-3 border-b border-dashed border-[#F1F5F9] pb-2 last:border-none last:pb-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-xs font-bold text-brand-primary">
                    @{(delivery.creator_artistic ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 text-[13px]">
                    <div className="mb-0.5 flex items-baseline justify-between">
                      <strong className="truncate text-[#0F172A]">@{delivery.creator_artistic}</strong>
                      <span className="shrink-0 font-mono text-[10px] font-bold tracking-tight text-brand-primary">{delivery.date ?? t("dash.today")}</span>
                    </div>
                    <div className="truncate text-[11px] text-[#64748B]">{delivery.type} • {delivery.campaign_name}</div>
                  </div>
                </div>
              ))}
              {!stats.deliveries?.length ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-[12px] text-[#64748B]">
                  <CheckCircle2 className="animate-bounce text-emerald-300" size={24} />
                  <span>{t("dash.allCaughtUp")}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { formatCurrency } = usePrivacy();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.dashboard().then(setStats).catch(alertApiError);
  }, []);

  if (!stats) {
    return (
      <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#6366F1] border-t-transparent" />
        <span className="animate-pulse text-xs font-bold tracking-wider text-[#64748B] uppercase">{t("dash.loadingMetrics")}</span>
      </div>
    );
  }

  if (user.role === "creator") {
    return (
      <>
        <PageHeader title={t("dash.startTitle")} subtitle={t("dash.hello", { name: user.name })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label={t("dash.campaigns")} value={stats.campaigns ?? 0} />
          <KpiCard label={t("dash.approved")} value={stats.approved_campaigns ?? 0} />
          <KpiCard label={t("dash.applications")} value={stats.pending_applications ?? 0} />
        </div>
        <div className="mt-6 flex gap-3">
          <Link href="/available-campaigns" className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white">{t("dash.available")}</Link>
          {user.creator?.id ? <Link href={`/creators/${user.creator.id}`} className="rounded-xl border px-4 py-2.5 text-sm font-bold">{t("dash.myProfile")}</Link> : null}
        </div>
      </>
    );
  }

  if (user.role === "company") {
    return (
      <>
        <PageHeader title={t("dash.companyPanel")} subtitle={user.company?.name ?? user.name} />
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label={t("dash.campaigns")} value={stats.campaigns ?? 0} />
          <KpiCard label={t("dash.running")} value={stats.running_campaigns ?? 0} />
          <KpiCard label={t("dash.investment")} value={formatCurrency(stats.total_campaign_value, stats.currency)} />
        </div>
      </>
    );
  }

  return <AdminDashboard stats={stats} />;
}

export function DashboardScreen() {
  return (
    <AuthenticatedShell>
      <DashboardInner />
    </AuthenticatedShell>
  );
}
