import { digitsOnly } from "@/lib/masks";
import { hasRegions } from "@/lib/geo";

export type ShippingAddress = {
  zip?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

export type ShippingForm = {
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export const EMPTY_SHIPPING: ShippingForm = {
  zip: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

export function formatPostalCode(country: string | null | undefined, value: string): string {
  if ((country || "BR") !== "BR") return value.slice(0, 20);
  const digits = digitsOnly(value, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function shippingFormFromAddress(country: string | null | undefined, address?: ShippingAddress | null): ShippingForm {
  if (!address) return { ...EMPTY_SHIPPING };
  return {
    zip: formatPostalCode(country, address.zip || ""),
    street: address.street || "",
    number: address.number || "",
    complement: address.complement || "",
    neighborhood: address.neighborhood || "",
    city: address.city || "",
    state: address.state || "",
  };
}

export function shippingPayload(country: string, form: ShippingForm): ShippingAddress | null {
  const zip = (country || "BR") === "BR" ? digitsOnly(form.zip, 8) : form.zip.trim();
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
  return started ? address : null;
}

export function shippingIssue(country: string, form: ShippingForm): "incomplete" | "zip" | null {
  const payload = shippingPayload(country, form);
  if (!payload) return null;
  const required = [payload.zip, payload.street, payload.number, payload.neighborhood, payload.city];
  if (hasRegions(country)) required.push(payload.state);
  if (required.some((value) => !value)) return "incomplete";
  if ((country || "BR") === "BR" && String(payload.zip).replace(/\D/g, "").length !== 8) return "zip";
  return null;
}

export function formatShippingLines(address?: ShippingAddress | null, country?: string | null): string[] {
  const countryCode = country || "BR";
  if (!address) return [];
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const extra = [address.complement, address.neighborhood].filter(Boolean).join(" · ");
  const city = [address.city, address.state].filter(Boolean).join(" - ");
  const zip = address.zip ? formatPostalCode(countryCode, address.zip) : "";
  return [street, extra, [city, zip].filter(Boolean).join(" · ")].filter(Boolean);
}
