import { countryLabel, hasRegions, normalizeCountry } from "@/lib/geo";
import { digitsOnly } from "@/lib/masks";

export type ShippingAddress = {
  country?: string | null;
  zip?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

export type ShippingForm = {
  country: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type PostalPlace = {
  country: string;
  zip: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

export const EMPTY_SHIPPING: ShippingForm = {
  country: "",
  zip: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

export function postalCodeReady(country: string | null | undefined, zip: string, mode: "auto" | "blur" = "blur"): boolean {
  const isBrazil = (country || "BR") === "BR";
  const code = isBrazil ? digitsOnly(zip, 8) : zip.trim();
  if (isBrazil) return code.length === 8;
  return code.length >= (mode === "auto" ? 5 : 3);
}

export function formatPostalCode(country: string | null | undefined, value: string): string {
  if ((country || "BR") !== "BR") return value.slice(0, 20);
  const digits = digitsOnly(value, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function shippingFormFromAddress(country: string | null | undefined, address?: ShippingAddress | null): ShippingForm {
  if (!address) return { ...EMPTY_SHIPPING, country: normalizeCountry(country) || "BR" };
  const addressCountry = normalizeCountry(address.country) || normalizeCountry(country) || "BR";
  return {
    country: addressCountry,
    zip: formatPostalCode(addressCountry, address.zip || ""),
    street: address.street || "",
    number: address.number || "",
    complement: address.complement || "",
    neighborhood: address.neighborhood || "",
    city: address.city || "",
    state: address.state || "",
  };
}

export function shippingCountryCode(profileCountry: string, form: Pick<ShippingForm, "country">): string {
  return normalizeCountry(form.country) || normalizeCountry(profileCountry) || "BR";
}

export function shippingPayload(profileCountry: string, form: ShippingForm): ShippingAddress | null {
  const country = shippingCountryCode(profileCountry, form);
  const zip = country === "BR" ? digitsOnly(form.zip, 8) : form.zip.trim();
  const address: ShippingAddress = {
    zip: zip || null,
    street: form.street.trim() || null,
    number: form.number.trim() || null,
    complement: form.complement.trim() || null,
    neighborhood: form.neighborhood.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
  };
  const started = Object.values(address).some((value) => Boolean(value));
  return started ? { ...address, country } : null;
}

export function hasCompleteShippingAddress(address?: ShippingAddress | null, profileCountry?: string | null): boolean {
  if (!address) return false;
  const country = normalizeCountry(address.country) || normalizeCountry(profileCountry) || "BR";
  const required = [address.zip, address.street, address.number, address.neighborhood, address.city];
  if (hasRegions(country)) required.push(address.state);
  if (required.some((value) => !String(value ?? "").trim())) return false;
  if (country === "BR" && String(address.zip).replace(/\D/g, "").length !== 8) return false;
  return true;
}

export function shippingIssue(profileCountry: string, form: ShippingForm): "incomplete" | "zip" | null {
  const payload = shippingPayload(profileCountry, form);
  if (!payload) return null;
  const country = payload.country || profileCountry || "BR";
  const required = [payload.zip, payload.street, payload.number, payload.neighborhood, payload.city];
  if (hasRegions(country)) required.push(payload.state);
  if (required.some((value) => !value)) return "incomplete";
  if (country === "BR" && String(payload.zip).replace(/\D/g, "").length !== 8) return "zip";
  return null;
}

export function formatShippingLines(address?: ShippingAddress | null, country?: string | null, locale = "pt-BR"): string[] {
  if (!address) return [];
  const countryCode = normalizeCountry(address.country) || normalizeCountry(country) || "BR";
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const extra = [address.complement, address.neighborhood].filter(Boolean).join(" · ");
  const city = [address.city, address.state].filter(Boolean).join(" - ");
  const zip = address.zip ? formatPostalCode(countryCode, address.zip) : "";
  const lines = [street, extra, [city, zip].filter(Boolean).join(" · ")].filter(Boolean);
  if (countryCode !== "BR") lines.push(countryLabel(countryCode, locale));
  return lines;
}
