import type { Campaign } from "@/lib/types";

export const DEFAULT_AGENCY_FEE_PERCENT = 20;

export function parseAgencyFeePercent(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return Math.round(parsed * 100) / 100;
}

export function agencyFeeFromBudget(totalBudget: number, percent: number): number {
  return Number(((Number(totalBudget) || 0) * percent / 100).toFixed(2));
}

export function currentAgencyFeePercent(campaign: Pick<Campaign, "agency_fee_percent" | "agency_fee" | "total_budget">): number {
  if (campaign.agency_fee_percent != null && Number.isFinite(Number(campaign.agency_fee_percent))) {
    return Number(campaign.agency_fee_percent);
  }
  const budget = Number(campaign.total_budget) || 0;
  const fee = Number(campaign.agency_fee) || 0;
  if (budget > 0 && fee > 0) {
    return Math.round((fee / budget) * 10000) / 100;
  }
  return DEFAULT_AGENCY_FEE_PERCENT;
}
