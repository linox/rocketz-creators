export type SensitiveKind = "cpf" | "cnpj" | "phone" | "email" | "text" | "line" | "name" | "zip" | "date" | "ip" | "pix";

export function maskSensitive(value: string | null | undefined, kind: SensitiveKind = "text"): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  switch (kind) {
    case "cpf": {
      const tail = raw.replace(/\D/g, "").slice(-2);
      return `•••.•••.•••-${tail || "••"}`;
    }
    case "cnpj": {
      const tail = raw.replace(/\D/g, "").slice(-2);
      return `••.•••.•••/••••-${tail || "••"}`;
    }
    case "phone": {
      const tail = raw.replace(/\D/g, "").slice(-4);
      return tail ? `(••) •••••-${tail}` : "••••••••";
    }
    case "email": {
      const at = raw.indexOf("@");
      if (at <= 0) return maskTail(raw, 2);
      return `${raw.slice(0, 1)}•••@${raw.slice(at + 1)}`;
    }
    case "zip": {
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 5) return `${digits.slice(0, 2)}•••-•••`;
      return "•••••";
    }
    case "date": {
      const iso = raw.match(/^(\d{4})-\d{2}-\d{2}/);
      if (iso) return `••/••/${iso[1]}`;
      const local = raw.match(/\d{4}/);
      return local ? `••/••/${local[0]}` : "••/••/••••";
    }
    case "ip": {
      const parts = raw.split(".");
      if (parts.length === 4) return `•••.•••.•••.${parts[3]}`;
      return maskTail(raw, 4);
    }
    case "name":
      return raw
        .split(/\s+/)
        .map((part) => (part.length <= 1 ? "•" : `${part.slice(0, 1)}${"•".repeat(Math.min(6, part.length - 1))}`))
        .join(" ");
    case "line":
      return raw.length <= 3 ? "••••" : `${raw.slice(0, 3)}${"•".repeat(Math.min(8, raw.length - 3))}`;
    case "pix":
      return maskTail(raw, 4);
    default:
      return maskTail(raw, 2);
  }
}

export function pixMaskKind(type?: string | null): SensitiveKind {
  if (type === "cpf") return "cpf";
  if (type === "cnpj") return "cnpj";
  if (type === "email") return "email";
  if (type === "phone") return "phone";
  return "pix";
}

export function maskShippingPreview(address?: { street?: string | null; city?: string | null; state?: string | null } | null): string {
  if (!address) return "";
  const street = (address.street || "").trim();
  const city = [address.city, address.state].filter(Boolean).join(" - ");
  const head = street ? maskSensitive(street, "line") : "";
  return [head, city].filter(Boolean).join("\n");
}

export function maskBankPreview(
  account?: {
    holder_name?: string | null;
    bank_name?: string | null;
    agency?: string | null;
    account?: string | null;
    pix_type?: string | null;
    pix_key?: string | null;
  } | null,
  legacyPix?: string | null,
): string {
  const holder = account?.holder_name ? maskSensitive(account.holder_name, "name") : "";
  const bank = account?.bank_name?.trim() || "";
  const agency = account?.agency ? maskSensitive(account.agency, "text") : "";
  const number = account?.account ? maskSensitive(account.account, "text") : "";
  const pix = (account?.pix_key || legacyPix || "").trim();
  const pixMasked = pix ? maskSensitive(pix, pixMaskKind(account?.pix_type)) : "";
  const numbers = [agency, number].filter(Boolean).join(" · ");
  return [holder, bank, numbers, pixMasked].filter(Boolean).join("\n");
}

function maskTail(value: string, keep: number): string {
  if (value.length <= keep) return "•".repeat(Math.max(4, value.length));
  return `${"•".repeat(Math.min(8, value.length - keep))}${value.slice(-keep)}`;
}
