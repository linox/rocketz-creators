export function formatBenefitPercent(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function parseBenefitPercent(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export function normalizeBenefitCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function parseBenefitSuffix(value: string): { ok: true; suffix: string | null } | { ok: false } {
  const suffix = normalizeBenefitCode(value);
  if (!suffix) return { ok: true, suffix: null };
  if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(suffix)) return { ok: false };
  return { ok: true, suffix };
}

export function benefitCouponPattern(
  t: (key: string, options?: Record<string, unknown>) => string,
  suffix: string | null | undefined,
): string {
  return t("campaigns.benefitCouponPattern", { suffix: normalizeBenefitCode(suffix || "") });
}

export type BenefitCouponFields = {
  is_benefit_coupon?: boolean;
  benefit_coupon_code?: string | null;
  benefit_discount_percent?: number | string | null;
  benefit_commission_percent?: number | string | null;
};

export function benefitCouponLine(
  t: (key: string, options?: Record<string, unknown>) => string,
  campaign: BenefitCouponFields,
): string {
  return t("campaigns.benefitCouponLine", {
    code: benefitCouponPattern(t, campaign.benefit_coupon_code),
    discount: formatBenefitPercent(campaign.benefit_discount_percent),
    commission: formatBenefitPercent(campaign.benefit_commission_percent),
  });
}
