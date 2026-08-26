import countriesMap from "@/lib/geo-countries.json";
import regionsMap from "@/lib/geo-regions.json";

export const DEFAULT_COUNTRY = "BR";
export const DEFAULT_CURRENCY = "BRL";

type CountryMap = Record<string, string>;
type RegionMap = Record<string, Record<string, string>>;

const COUNTRIES = countriesMap as CountryMap;
const REGIONS = regionsMap as RegionMap;

export function normalizeCountry(value?: string | null): string {
  return String(value || "").trim().toUpperCase();
}

export function normalizeCurrency(value?: string | null): string {
  return String(value || "").trim().toUpperCase();
}

export function normalizeRegion(value?: string | null): string {
  return String(value || "").trim().toUpperCase();
}

export function isValidCountry(value?: string | null): boolean {
  const code = normalizeCountry(value);
  return Boolean(code && COUNTRIES[code]);
}

export function defaultCurrencyForCountry(country?: string | null): string {
  const code = normalizeCountry(country) || DEFAULT_COUNTRY;
  return COUNTRIES[code] || DEFAULT_CURRENCY;
}

export function isValidCurrency(value?: string | null): boolean {
  const code = normalizeCurrency(value);
  return Boolean(code && Object.values(COUNTRIES).includes(code));
}

export function regionsForCountry(country?: string | null): Record<string, string> {
  return REGIONS[normalizeCountry(country)] || {};
}

export function hasRegions(country?: string | null): boolean {
  return Object.keys(regionsForCountry(country)).length > 0;
}

export function isValidRegion(country?: string | null, region?: string | null): boolean {
  const code = normalizeRegion(region);
  if (!code) return false;
  const regions = regionsForCountry(country);
  return Object.keys(regions).length === 0 || Boolean(regions[code]);
}

export function resolveCurrency(value?: string | null): string {
  const code = normalizeCurrency(value);
  return isValidCurrency(code) ? code : DEFAULT_CURRENCY;
}

export function countryLabel(code: string, locale: string): string {
  const normalized = normalizeCountry(code);
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(normalized) || normalized;
  } catch {
    return normalized;
  }
}

export function currencyLabel(code: string, locale: string): string {
  const normalized = resolveCurrency(code);
  try {
    const name = new Intl.DisplayNames([locale], { type: "currency" }).of(normalized);
    return name ? `${normalized} — ${name}` : normalized;
  } catch {
    return normalized;
  }
}

export function regionLabel(country: string, region: string): string {
  const code = normalizeRegion(region);
  return regionsForCountry(country)[code] || code;
}

export function countryOptions(locale: string): { value: string; label: string }[] {
  return Object.keys(COUNTRIES)
    .map((code) => ({ value: code, label: countryLabel(code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }));
}

export function regionOptions(country: string, locale: string): { value: string; label: string }[] {
  return Object.entries(regionsForCountry(country))
    .map(([value, label]) => ({ value, label: `${label}` }))
    .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }));
}

export function currencyOptions(locale: string): { value: string; label: string }[] {
  const codes = [...new Set(Object.values(COUNTRIES))].sort();
  return codes.map((code) => ({ value: code, label: currencyLabel(code, locale) }));
}

export function campaignLocationLabel(
  locale: string,
  campaign?: {
    limit_by_city?: boolean | null;
    city?: string | null;
    state?: string | null;
    company?: { country?: string | null } | null;
  } | null,
): string {
  if (!campaign?.limit_by_city) return "";
  return formatLocation(locale, {
    city: campaign.city,
    state: campaign.state,
    country: campaign.company?.country,
  });
}

export function formatLocation(
  locale: string,
  parts: { city?: string | null; state?: string | null; country?: string | null },
): string {
  const country = normalizeCountry(parts.country);
  const region = parts.state ? regionLabel(country || DEFAULT_COUNTRY, parts.state) : "";
  const countryName = country ? countryLabel(country, locale) : "";
  return [parts.city, region, countryName].filter(Boolean).join(", ");
}

export function moneyCurrency(item?: { currency?: string | null; company?: { currency?: string | null } | null } | null): string {
  return resolveCurrency(item?.currency || item?.company?.currency);
}

export function currencySymbol(currency?: string | null, locale = "pt-BR"): string {
  const code = resolveCurrency(currency);
  try {
    return (
      new Intl.NumberFormat(locale, { style: "currency", currency: code })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value || code
    );
  } catch {
    return code;
  }
}

export function formatMoneyGroups(
  formatCurrency: (value?: number | null, currency?: string | null) => string,
  items: Array<{ amount: number; currency?: string | null }>,
): string {
  const totals = new Map<string, number>();
  for (const item of items) {
    const code = resolveCurrency(item.currency);
    totals.set(code, (totals.get(code) || 0) + item.amount);
  }
  if (totals.size === 0) return formatCurrency(0);
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(" · ");
}
