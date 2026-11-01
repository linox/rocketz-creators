"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CheckCircle2, FileText, Megaphone, Repeat, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { peekLaravelGet } from "@/lib/laravel";
import { alertApiError } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import { usePrivacy } from "@/lib/privacy";
import type { DashboardDeliveryPoint, DashboardStats } from "@/lib/types";

const DELIVERY_COLORS = {
  published: "#10B981",
  inProgress: "#6366F1",
  overdue: "#F59E0B",
  budget: "#64748B",
} as const;

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function DeliveryChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: DashboardDeliveryPoint }[];
}) {
  const { t } = useTranslation("app");
  const { formatCurrency, formatNumber } = usePrivacy();
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const lines = [
    { key: "published", label: t("dash.deliveryPublished"), color: DELIVERY_COLORS.published, total: row.published, campaign: row.campaign_published, recurring: row.recurring_published },
    { key: "in_progress", label: t("dash.deliveryInProgress"), color: DELIVERY_COLORS.inProgress, total: row.in_progress, campaign: row.campaign_in_progress, recurring: row.recurring_in_progress },
    { key: "overdue", label: t("dash.deliveryOverdueLabel"), color: DELIVERY_COLORS.overdue, total: row.overdue, campaign: row.campaign_overdue, recurring: row.recurring_overdue },
  ] as const;

  return (
    <div className="min-w-[190px] rounded-xl bg-white px-3 py-2.5 text-[12px] shadow-lg">
      <div className="mb-2 font-bold text-[#0F172A]">{row.name}</div>
      {lines.map((line) => (
        <div key={line.key} className="mb-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F172A]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
              {line.label}
            </span>
            <span className="font-bold text-[#0F172A]">{formatNumber(line.total)}</span>
          </div>
          {line.total > 0 ? (
            <div className="pl-3.5 text-[10px] text-[#64748B]">
              {t("dash.deliverySplit", { campaign: line.campaign, recurring: line.recurring })}
            </div>
          ) : null}
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5 font-semibold text-[#64748B]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-2 rounded-full" style={{ backgroundColor: DELIVERY_COLORS.budget }} />
          {t("dash.budgetCombined")}
        </span>
        <span className="text-[#0F172A]">{formatCurrency(row.budget)}</span>
      </div>
    </div>
  );
}

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
  const { formatCurrency, formatNumber, hideValues } = usePrivacy();
  const deliveries = stats.content_deliveries ?? [];
  const emptyChart = !deliveries.length || deliveries.every((row) => !row.published && !row.in_progress && !row.overdue && !row.budget);
  const current = deliveries.find((row) => row.current) ?? deliveries.at(-1);
  const planned = (current?.published ?? 0) + (current?.in_progress ?? 0) + (current?.overdue ?? 0);
  const pendingAgency = (stats.pending_agency_campaigns ?? 0) + (stats.pending_agency_recurring ?? 0);
  const hasRecurringWork = (stats.running_recurring ?? 0) > 0
    || (stats.pending_agency_recurring ?? 0) > 0
    || (stats.recurring_preview?.length ?? 0) > 0;

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

      {pendingAgency > 0 ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-indigo-500/10 p-4 shadow-xs sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <Repeat size={20} />
            </div>
            <div>
              <h4 className="m-0 text-sm font-bold text-violet-950">
                {t("dash.pendingAgencyTitle", { count: pendingAgency })}
              </h4>
              <p className="mt-0.5 text-xs leading-relaxed text-violet-800">
                {t("dash.pendingAgencyHint", {
                  campaigns: stats.pending_agency_campaigns ?? 0,
                  recurring: stats.pending_agency_recurring ?? 0,
                })}
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            {(stats.pending_agency_campaigns ?? 0) > 0 ? (
              <Link href="/campaigns" className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700">
                {t("dash.reviewCampaigns")}
                <ArrowRight size={14} />
              </Link>
            ) : null}
            {(stats.pending_agency_recurring ?? 0) > 0 ? (
              <Link href="/recurring" className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 py-2 text-xs font-bold text-violet-800 hover:bg-violet-50">
                {t("dash.reviewRecurring")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
        <KpiCard label={t("dash.kpiCasting")} value={formatNumber(stats.total_creators)} />
        <KpiCard label={t("dash.kpiCompanies")} value={formatNumber(stats.total_companies ?? 0)} />
        <KpiCard label={t("dash.kpiContent")} value={formatNumber(stats.managed_content ?? 0)} />
        <KpiCard label={t("dash.kpiCampaigns")} value={stats.running_campaigns ?? 0} />
        {hasRecurringWork ? <KpiCard label={t("dash.kpiRecurring")} value={stats.running_recurring ?? 0} /> : null}
        <KpiCard label={t("dash.kpiBudget")} value={formatCurrency(stats.total_managed_value ?? stats.total_campaign_value)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-2 border-b border-[#E2E8F0] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[16px] font-bold text-[#0F172A]">{t("dash.revenue")}</h2>
            {current && planned > 0 ? (
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-[12px] font-bold text-brand-primary">
                  {t("dash.deliverySummary", { count: current.published, published: formatNumber(current.published), planned: formatNumber(planned) })}
                </span>
                {(current.overdue ?? 0) > 0 ? (
                  <span className="text-[11px] font-semibold text-amber-600">
                    {t("dash.deliveryOverdue", { count: current.overdue })}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex h-[280px] w-full flex-col p-3 sm:h-[360px] sm:p-6">
            {emptyChart ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <TrendingUp size={28} className="animate-pulse text-slate-300" />
                <span className="text-xs font-bold text-slate-700">{t("dash.emptyChart")}</span>
                <span className="max-w-xs text-[11px] text-[#64748B]">{t("dash.emptyChartHint")}</span>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
                  <LegendDot color={DELIVERY_COLORS.published} label={t("dash.deliveryPublished")} />
                  <LegendDot color={DELIVERY_COLORS.inProgress} label={t("dash.deliveryInProgress")} />
                  <LegendDot color={DELIVERY_COLORS.overdue} label={t("dash.deliveryOverdueLabel")} />
                  <LegendDot color={DELIVERY_COLORS.budget} label={t("dash.budget")} />
                </div>
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={deliveries} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis yAxisId="count" allowDecimals={false} axisLine={false} tickLine={false} width={32} tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis
                        yAxisId="budget"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        width={72}
                        tickFormatter={(val) => (hideValues ? "••••" : `R$ ${formatNumber(Number(val))}`)}
                        tick={{ fill: "#64748b", fontSize: 10 }}
                      />
                      <Tooltip content={<DeliveryChartTooltip />} cursor={{ fill: "#F8FAFC" }} />
                      <Bar yAxisId="count" dataKey="published" stackId="deliveries" fill={DELIVERY_COLORS.published} maxBarSize={28} />
                      <Bar yAxisId="count" dataKey="in_progress" stackId="deliveries" fill={DELIVERY_COLORS.inProgress} maxBarSize={28} />
                      <Bar yAxisId="count" dataKey="overdue" stackId="deliveries" fill={DELIVERY_COLORS.overdue} maxBarSize={28} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="budget" type="monotone" dataKey="budget" stroke={DELIVERY_COLORS.budget} strokeWidth={2} dot={{ r: 3, fill: DELIVERY_COLORS.budget }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
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
              {(stats.deliveries ?? []).map((delivery) => {
                const inner = (
                  <>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-xs font-bold text-brand-primary">
                      @{(delivery.creator_artistic ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 text-[13px]">
                      <div className="mb-0.5 flex items-baseline justify-between gap-2">
                        <strong className="truncate text-[#0F172A]">@{delivery.creator_artistic}</strong>
                        <span className="shrink-0 font-mono text-[10px] font-bold tracking-tight text-brand-primary">{delivery.date ?? t("dash.today")}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#64748B]">
                        <span className={delivery.source === "recurring" ? "shrink-0 rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-purple-700 uppercase" : "shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-indigo-700 uppercase"}>
                          {delivery.source === "recurring" ? t("dash.sourceRecurring") : t("dash.sourceCampaign")}
                        </span>
                        <span className="truncate">{delivery.campaign_name}</span>
                      </div>
                    </div>
                  </>
                );
                return delivery.href ? (
                  <Link key={delivery.id} href={delivery.href} className="flex items-center gap-3 border-b border-dashed border-[#F1F5F9] pb-2 text-inherit last:border-none last:pb-0 hover:opacity-80">
                    {inner}
                  </Link>
                ) : (
                  <div key={delivery.id} className="flex items-center gap-3 border-b border-dashed border-[#F1F5F9] pb-2 last:border-none last:pb-0">
                    {inner}
                  </div>
                );
              })}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={hasRecurringWork ? "overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm" : "overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm lg:col-span-2"}>
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
            <h2 className="flex items-center gap-2 text-[16px] font-bold text-[#0F172A]">
              <Megaphone size={16} className="text-brand-primary" /> {t("dash.campaignsList")}
            </h2>
            <Link href="/campaigns" className="text-[11px] font-bold text-brand-primary hover:underline">{t("dash.viewAll")}</Link>
          </div>
          <div className="flex flex-col gap-3 p-6">
            {(stats.campaigns_preview ?? []).map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="flex items-center justify-between gap-3 border-b border-dashed border-[#F1F5F9] pb-3 last:border-none last:pb-0">
                <div className="min-w-0">
                  <strong className="block truncate text-[13px] text-[#0F172A]">{campaign.name}</strong>
                  <span className="truncate text-[11px] text-[#64748B]">{campaign.company_name}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] font-bold text-[#0F172A]">{formatCurrency(campaign.total_budget)}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold tracking-wider text-slate-600 uppercase">
                    {t(`status.${campaign.status}`, { defaultValue: campaign.status ?? "" })}
                  </span>
                </div>
              </Link>
            ))}
            {!stats.campaigns_preview?.length ? (
              <p className="m-0 py-4 text-center text-[12px] text-[#64748B]">{t("dash.noCampaigns")}</p>
            ) : null}
          </div>
        </div>

        {hasRecurringWork ? (
        <div className="overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
            <h2 className="flex items-center gap-2 text-[16px] font-bold text-[#0F172A]">
              <Repeat size={16} className="text-purple-600" /> {t("dash.recurringList")}
            </h2>
            <Link href="/recurring" className="text-[11px] font-bold text-brand-primary hover:underline">{t("dash.viewAll")}</Link>
          </div>
          <div className="flex flex-col gap-3 p-6">
            {(stats.recurring_preview ?? []).map((contract) => (
              <Link key={contract.id} href={`/recurring/${contract.id}`} className="flex items-center justify-between gap-3 border-b border-dashed border-[#F1F5F9] pb-3 last:border-none last:pb-0">
                <div className="min-w-0">
                  <strong className="block truncate text-[13px] text-[#0F172A]">{contract.title}</strong>
                  <span className="truncate text-[11px] text-[#64748B]">{contract.company_name}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] font-bold text-[#0F172A]">{formatCurrency(contract.monthly_fee)}</span>
                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[9px] font-bold tracking-wider text-purple-700 uppercase">
                    {t(`status.${contract.status}`, { defaultValue: contract.status ?? "" })}
                  </span>
                </div>
              </Link>
            ))}
            {!stats.recurring_preview?.length ? (
              <p className="m-0 py-4 text-center text-[12px] text-[#64748B]">{t("dash.noRecurring")}</p>
            ) : null}
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}

function DashboardInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { formatCurrency } = usePrivacy();
  const [stats, setStats] = useState<DashboardStats | null>(() => peekLaravelGet<DashboardStats>("/dashboard"));

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
