import { formatCNPJ, formatCPF, formatWhatsApp, isValidCNPJ, isValidCPF, isValidWhatsApp } from "@/lib/masks";

export const BANK_ACCOUNT_TYPES = ["checking", "savings"] as const;
export const PIX_TYPES = ["cpf", "cnpj", "email", "phone", "random"] as const;

export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];
export type PixType = (typeof PIX_TYPES)[number];

export type BankAccount = {
  holder_name?: string | null;
  bank_name?: string | null;
  agency?: string | null;
  account?: string | null;
  account_type?: string | null;
  pix_type?: string | null;
  pix_key?: string | null;
};

export type BankForm = {
  holderName: string;
  bankName: string;
  agency: string;
  account: string;
  accountType: string;
  pixType: string;
  pixKey: string;
};

export const EMPTY_BANK: BankForm = {
  holderName: "",
  bankName: "",
  agency: "",
  account: "",
  accountType: "",
  pixType: "",
  pixKey: "",
};

export function bankFormFromAccount(account?: BankAccount | null, legacyPix?: string | null): BankForm {
  const pixSource = account?.pix_key || (!account ? legacyPix : "") || "";
  const pixType = account?.pix_type || inferPixType(pixSource);
  return {
    holderName: account?.holder_name || "",
    bankName: account?.bank_name || "",
    agency: account?.agency || "",
    account: account?.account || "",
    accountType: account?.account_type || "",
    pixType,
    pixKey: formatPixKey(pixType, pixSource),
  };
}

function inferPixType(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits === trimmed.replace(/\D/g, "")) return "cpf";
  if (digits.length === 14) return "cnpj";
  if (trimmed.replace(/\s/g, "").length >= 32 && !trimmed.includes("@")) return "random";
  return "";
}

export function formatPixKey(type: string | null | undefined, value: string | null | undefined): string {
  const raw = value || "";
  if (type === "cpf") return formatCPF(raw);
  if (type === "cnpj") return formatCNPJ(raw);
  if (type === "phone") return formatWhatsApp(raw);
  if (type === "email") return raw.trim().slice(0, 77);
  if (type === "random") return raw.replace(/\s/g, "").slice(0, 77);
  return raw.trim().slice(0, 77);
}

export function bankPayload(form: BankForm): BankAccount | null {
  const holder = form.holderName.trim();
  const bank = form.bankName.trim();
  const agency = form.agency.replace(/\D/g, "").slice(0, 6);
  const account = form.account.replace(/[^\d-]/g, "").slice(0, 20);
  const accountType = form.accountType;
  const pixType = form.pixType;
  const pixKey = formatPixKey(pixType, form.pixKey).trim();
  const started = [holder, bank, agency, account, accountType, pixType, pixKey].some(Boolean);
  if (!started) return null;
  return {
    holder_name: holder || null,
    bank_name: bank || null,
    agency: agency || null,
    account: account || null,
    account_type: accountType || null,
    pix_type: pixType || null,
    pix_key: pixKey || null,
  };
}

export function bankIssue(form: BankForm): "bank" | "pix" | null {
  const payload = bankPayload(form);
  if (!payload) return null;
  const bankStarted = [payload.bank_name, payload.agency, payload.account, payload.account_type, payload.holder_name].some(Boolean);
  if (bankStarted && (!payload.bank_name || !payload.agency || !payload.account || !BANK_ACCOUNT_TYPES.includes(payload.account_type as BankAccountType))) {
    return "bank";
  }
  const pixStarted = Boolean(payload.pix_type || payload.pix_key);
  if (!pixStarted) return null;
  if (!payload.pix_type || !payload.pix_key || !PIX_TYPES.includes(payload.pix_type as PixType)) return "pix";
  if (!pixKeyMatches(payload.pix_type, payload.pix_key)) return "pix";
  return null;
}

export function formatBankLines(
  account?: BankAccount | null,
  labels?: { checking: string; savings: string; agency: string; account: string },
): string[] {
  if (!account) return [];
  const type = account.account_type === "checking"
    ? labels?.checking
    : account.account_type === "savings"
      ? labels?.savings
      : "";
  const bank = [account.bank_name, type].filter(Boolean).join(" · ");
  const numbers = [
    account.agency && labels?.agency ? `${labels.agency} ${account.agency}` : account.agency || "",
    account.account && labels?.account ? `${labels.account} ${account.account}` : account.account || "",
  ].filter(Boolean).join(" · ");
  return [account.holder_name || "", bank, numbers, account.pix_key || ""].filter(Boolean);
}

function pixKeyMatches(type: string, value: string): boolean {
  if (type === "cpf") return isValidCPF(value);
  if (type === "cnpj") return isValidCNPJ(value);
  if (type === "phone") return isValidWhatsApp(value);
  if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (type === "random") return value.replace(/\s/g, "").length >= 32;
  return false;
}
