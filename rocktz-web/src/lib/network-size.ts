import { parseIntegerMask } from "@/lib/masks";

export type NetworkTier = "" | "nano" | "micro" | "mid" | "macro" | "mega" | "custom";

export const NETWORK_TIER_BOUNDS: Record<Exclude<NetworkTier, "" | "custom">, { min: number | null; max: number | null }> = {
  nano: { min: null, max: 10_000 },
  micro: { min: 10_001, max: 100_000 },
  mid: { min: 100_001, max: 500_000 },
  macro: { min: 500_001, max: 1_000_000 },
  mega: { min: 1_000_001, max: null },
};

const NETWORK_KEYS = ["instagram_followers", "tiktok_followers", "youtube_followers", "youtube_subscribers", "followers"];

export function networkSize(metrics?: Record<string, number> | null): number {
  let max = 0;
  for (const key of NETWORK_KEYS) {
    const value = Number(metrics?.[key] ?? 0);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max;
}

export function matchesNetworkRange(size: number, min?: number | null, max?: number | null): boolean {
  if (min != null && size < min) return false;
  if (max != null && size > max) return false;
  return true;
}

export function tierFromRange(min?: number | null, max?: number | null): NetworkTier {
  const normalizedMin = min ?? null;
  const normalizedMax = max ?? null;
  if (normalizedMin == null && normalizedMax == null) return "";
  for (const [key, bounds] of Object.entries(NETWORK_TIER_BOUNDS) as [Exclude<NetworkTier, "" | "custom">, { min: number | null; max: number | null }][]) {
    if (bounds.min === normalizedMin && bounds.max === normalizedMax) return key;
  }
  return "custom";
}

export function rangeFromTier(tier: string, customMin: string, customMax: string): { min: number | null; max: number | null } {
  if (!tier || tier === "all") return { min: null, max: null };
  if (tier === "custom") {
    return {
      min: customMin.trim() ? parseIntegerMask(customMin) : null,
      max: customMax.trim() ? parseIntegerMask(customMax) : null,
    };
  }
  const bounds = NETWORK_TIER_BOUNDS[tier as Exclude<NetworkTier, "" | "custom">];
  return bounds ?? { min: null, max: null };
}

export function networkTierI18nKey(tier: string): string | null {
  if (!tier || tier === "all") return null;
  return `creators.network${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
}
