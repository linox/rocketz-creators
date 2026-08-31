import { DEFAULT_COUNTRY, normalizeCountry } from "@/lib/geo";
import { formatCNPJ, formatCPF, isValidCNPJ, isValidCPF } from "@/lib/masks";

type TaxDocumentPair = {
  personal: string;
  company: string;
  placeholder?: string;
  maxLength: number;
};

const PAIR: Record<string, TaxDocumentPair> = {
  BR: { personal: "CPF", company: "CNPJ", placeholder: "000.000.000-00 / 00.000.000/0001-00", maxLength: 18 },
  AR: { personal: "CUIL", company: "CUIT", placeholder: "00-00000000-0", maxLength: 13 },
  MX: { personal: "RFC", company: "RFC", maxLength: 13 },
  CL: { personal: "RUT", company: "RUT", maxLength: 12 },
  CO: { personal: "CC", company: "NIT", maxLength: 15 },
  PE: { personal: "DNI", company: "RUC", maxLength: 11 },
  UY: { personal: "CI", company: "RUT", maxLength: 12 },
  PY: { personal: "CI", company: "RUC", maxLength: 12 },
  VE: { personal: "Cédula", company: "RIF", maxLength: 12 },
  EC: { personal: "Cédula", company: "RUC", maxLength: 13 },
  BO: { personal: "CI", company: "NIT", maxLength: 15 },
  GT: { personal: "DPI", company: "NIT", maxLength: 17 },
  CR: { personal: "Cédula", company: "Cédula jurídica", maxLength: 12 },
  PA: { personal: "Cédula", company: "RUC", maxLength: 20 },
  DO: { personal: "Cédula", company: "RNC", maxLength: 11 },
  HN: { personal: "DNI", company: "RTN", maxLength: 14 },
  SV: { personal: "DUI", company: "NIT", maxLength: 17 },
  NI: { personal: "Cédula", company: "RUC", maxLength: 14 },
  CU: { personal: "CI", company: "NIT", maxLength: 15 },
  PT: { personal: "NIF", company: "NIPC", maxLength: 9 },
  ES: { personal: "NIF", company: "CIF", maxLength: 9 },
  US: { personal: "SSN", company: "EIN", placeholder: "000-00-0000 / 00-0000000", maxLength: 11 },
  CA: { personal: "SIN", company: "BN", maxLength: 15 },
  GB: { personal: "NINO", company: "UTR", maxLength: 13 },
  FR: { personal: "NIF", company: "SIRET", maxLength: 17 },
  DE: { personal: "Steuer-ID", company: "USt-IdNr", maxLength: 15 },
  IT: { personal: "Codice fiscale", company: "P.IVA", maxLength: 16 },
  AO: { personal: "NIF", company: "NIF", maxLength: 14 },
  MZ: { personal: "NUIT", company: "NUIT", maxLength: 9 },
  CV: { personal: "NIF", company: "NIF", maxLength: 9 },
  GW: { personal: "NIF", company: "NIF", maxLength: 9 },
  ST: { personal: "NIF", company: "NIF", maxLength: 9 },
  TL: { personal: "TIN", company: "TIN", maxLength: 20 },
};

function pairFor(country?: string | null): TaxDocumentPair | null {
  const code = normalizeCountry(country) || DEFAULT_COUNTRY;
  return PAIR[code] ?? null;
}

export function taxDocumentsLabel(
  country: string | null | undefined,
  conjunction: string,
  fallback: string,
): string {
  const pair = pairFor(country);
  if (!pair) {
    return fallback;
  }
  if (pair.personal === pair.company) {
    return pair.personal;
  }
  return `${pair.personal} ${conjunction} ${pair.company}`;
}

export function taxDocumentMaxLength(country?: string | null): number {
  return pairFor(country)?.maxLength ?? 40;
}

export function taxDocumentPlaceholder(
  country: string | null | undefined,
  fallback: string,
): string {
  return pairFor(country)?.placeholder || fallback;
}

export function formatTaxDocument(country: string | null | undefined, value: string): string {
  const code = normalizeCountry(country) || DEFAULT_COUNTRY;
  const max = taxDocumentMaxLength(code);
  if (code === "BR") {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits.length > 11 ? formatCNPJ(digits) : formatCPF(digits);
  }
  return value.slice(0, max);
}

export function isValidTaxDocument(country: string | null | undefined, value: string): boolean {
  const code = normalizeCountry(country) || DEFAULT_COUNTRY;
  if (code === "BR") {
    return isValidCPF(value) || isValidCNPJ(value);
  }
  const trimmed = value.trim();
  return trimmed.length >= 5 && trimmed.length <= 40;
}

export function taxDocumentKindLabel(
  country: string | null | undefined,
  value: string,
  documentsLabel: string,
): string {
  const code = normalizeCountry(country) || DEFAULT_COUNTRY;
  if (code === "BR") {
    if (isValidCPF(value)) return "CPF";
    if (isValidCNPJ(value)) return "CNPJ";
  }
  return documentsLabel;
}
