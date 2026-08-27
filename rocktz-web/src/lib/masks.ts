import { localeForCurrency, resolveCurrency } from "@/lib/geo";

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const UF_NAMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export const UF_OPTIONS = UF_LIST.map((uf) => ({
  value: uf,
  label: `${uf} — ${UF_NAMES[uf]}`,
}));

export function digitsOnly(value: string, max?: number): string {
  const digits = value.replace(/\D/g, "");
  return max ? digits.slice(0, max) : digits;
}

export function nationalPhoneDigits(value: string): string {
  let digits = digitsOnly(String(value ?? ""));
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

export function formatWhatsApp(value: string): string {
  const digits = nationalPhoneDigits(value);
  if (digits.length === 0) {
    return "";
  }
  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function isValidWhatsApp(value: string): boolean {
  const digits = nationalPhoneDigits(value);
  return digits.length === 10 || digits.length === 11;
}

export function formatCNPJ(value: string): string {
  const digits = digitsOnly(value, 14);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const check = (base: string, factors: number[]) => {
    const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * factors[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const first = check(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = check(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

export function formatCPF(value: string): string {
  const digits = digitsOnly(value, 11);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function isValidCPF(value: string): boolean {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digit = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (factor - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 || rest === 11 ? 0 : rest;
  };

  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) && digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export function formatInstagram(value: string): string {
  const handle = instagramHandle(value);
  return handle ? `@${handle}` : "";
}

export function instagramHandle(value: string): string {
  let handle = String(value ?? "").trim();
  if (!handle) return "";

  handle = handle.replace(/^@+/, "");

  try {
    const candidate = /^https?:\/\//i.test(handle) ? handle : `https://${handle.replace(/^\/+/, "")}`;
    const url = new URL(candidate);
    if (/(^|\.)instagram\.com$/i.test(url.hostname)) {
      handle = (url.pathname.split("/").filter(Boolean)[0] || "").replace(/^@+/, "");
    }
  } catch {
    /* keep handle */
  }

  handle = handle.replace(/^https?:\/\//i, "");
  handle = handle.replace(/^(www\.)?instagram\.com\/?/i, "");
  handle = handle.replace(/[/?#].*$/, "");
  handle = handle.replace(/^@+/, "").replace(/\s/g, "");
  handle = handle.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30);

  const invalid = !handle || /^https?$/i.test(handle) || /^www$/i.test(handle) || /^instagram\.com$/i.test(handle);
  return invalid ? "" : handle;
}

export function formatTikTok(value: string): string {
  let handle = value.trim();
  handle = handle.replace(/^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\//i, "");
  handle = handle.replace(/^@+/, "");
  handle = handle.replace(/[/?].*$/, "");
  handle = handle.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 24);
  return handle ? `@${handle}` : "";
}

export function formatYouTube(value: string): string {
  let handle = value.trim();
  handle = handle.replace(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i, "");
  handle = handle.replace(/^@+/, "");
  handle = handle.replace(/^(c|user|channel)\//i, "");
  handle = handle.replace(/[/?].*$/, "").replace(/\s/g, "");
  return handle ? `@${handle}` : "";
}

export function formatKwai(value: string): string {
  let handle = value.trim();
  handle = handle.replace(/^https?:\/\/(www\.)?kwai\.com\//i, "");
  handle = handle.replace(/^@+/, "");
  handle = handle.replace(/[/?].*$/, "");
  handle = handle.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 24);
  return handle ? `@${handle}` : "";
}

export function moneySeparators(currency?: string | null): {
  locale: string;
  group: string;
  decimal: string;
  fractionDigits: number;
} {
  const code = resolveCurrency(currency);
  const locale = localeForCurrency(code);
  let fractionDigits = 2;
  try {
    fractionDigits = new Intl.NumberFormat(locale, { style: "currency", currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    fractionDigits = 2;
  }
  const parts = new Intl.NumberFormat(locale, {
    useGrouping: true,
    minimumFractionDigits: Math.min(2, fractionDigits),
    maximumFractionDigits: Math.min(2, fractionDigits),
  }).formatToParts(1234567.89);
  return {
    locale,
    group: parts.find((part) => part.type === "group")?.value ?? ".",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ",",
    fractionDigits,
  };
}

export function moneyPlaceholder(currency?: string | null): string {
  const { locale, fractionDigits } = moneySeparators(currency);
  return (0).toLocaleString(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

export function formatMoneyMask(value: string, currency?: string | null): string {
  const { locale, decimal, fractionDigits } = moneySeparators(currency);
  if (fractionDigits <= 0) {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    if (!digits) return "";
    return Number(digits).toLocaleString(locale);
  }

  const lastDecimal = value.lastIndexOf(decimal);
  const hasDecimal = lastDecimal >= 0;
  const intRaw = hasDecimal ? value.slice(0, lastDecimal) : value;
  const decRaw = hasDecimal ? value.slice(lastDecimal + 1) : "";
  const intDigits = intRaw.replace(/\D/g, "").slice(0, 10);
  if (!intDigits && !hasDecimal) return "";
  const formattedInt = intDigits ? Number(intDigits).toLocaleString(locale) : "0";
  if (hasDecimal) {
    return `${formattedInt}${decimal}${decRaw.replace(/\D/g, "").slice(0, fractionDigits)}`;
  }
  return formattedInt;
}

export function parseMoneyMask(value: string, currency?: string | null): number {
  if (!value.trim()) return 0;
  const { group, decimal, fractionDigits } = moneySeparators(currency);
  if (fractionDigits <= 0) {
    return Number(value.replace(/\D/g, "")) || 0;
  }
  let normalized = value.trim();
  if (group) normalized = normalized.split(group).join("");
  if (decimal) normalized = normalized.replace(decimal, ".");
  normalized = normalized.replace(/[^\d.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function moneyToMask(amount: number | string | null | undefined, currency?: string | null): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "";
  const { locale, fractionDigits } = moneySeparators(currency);
  return n.toLocaleString(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

export function remaskMoney(value: string, fromCurrency?: string | null, toCurrency?: string | null): string {
  return moneyToMask(parseMoneyMask(value, fromCurrency), toCurrency);
}

export function formatBRLMask(value: string): string {
  return formatMoneyMask(value, "BRL");
}

export function parseBRLMask(value: string): number {
  return parseMoneyMask(value, "BRL");
}

export function formatIntegerMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  return Number(digits).toLocaleString("pt-BR");
}

export function parseIntegerMask(value: string): number {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function integerToMask(amount: number | string | null | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "";
  return Math.round(n).toLocaleString("pt-BR");
}

export function formatUF(value: string): string {
  return value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
}

export function isValidUF(value: string): boolean {
  return UF_LIST.includes(formatUF(value));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type PasswordIssue = "too_short" | "mismatch";

export function passwordError(password: string, confirmation?: string): PasswordIssue | null {
  if (password.length < 8) {
    return "too_short";
  }
  if (confirmation !== undefined && password !== confirmation) {
    return "mismatch";
  }
  return null;
}
