export type AgeLimitedCampaign = {
  limit_by_age?: boolean | null;
  min_age?: number | null;
  max_age?: number | null;
};

export function campaignAgeLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  campaign: AgeLimitedCampaign,
): string {
  if (campaign.min_age != null && campaign.max_age != null) {
    return t("campaigns.ageBetween", { min: campaign.min_age, max: campaign.max_age });
  }
  if (campaign.min_age != null) {
    return t("campaigns.ageMin", { min: campaign.min_age });
  }
  if (campaign.max_age != null) {
    return t("campaigns.ageMax", { max: campaign.max_age });
  }
  return t("campaigns.ageLimited");
}

export function parseAgeLimit(enabled: boolean, minRaw: string, maxRaw: string):
  | { ok: true; limit_by_age: boolean; min_age: number | null; max_age: number | null }
  | { ok: false; error: "invalid" | "required" | "range" } {
  if (!enabled) {
    return { ok: true, limit_by_age: false, min_age: null, max_age: null };
  }

  const min = readAgeBound(minRaw);
  const max = readAgeBound(maxRaw);
  if (min === "invalid" || max === "invalid") {
    return { ok: false, error: "invalid" };
  }
  if (min == null && max == null) {
    return { ok: false, error: "required" };
  }
  if (min != null && max != null && max < min) {
    return { ok: false, error: "range" };
  }

  return { ok: true, limit_by_age: true, min_age: min, max_age: max };
}

function readAgeBound(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}$/.test(trimmed)) return "invalid";
  const age = Number(trimmed);
  if (age > 120) return "invalid";
  return age;
}
