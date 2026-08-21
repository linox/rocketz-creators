export type PautaBriefingFields = {
  product: string;
  key_message: string;
  must_have: string;
  donts: string;
  cta: string;
  hashtags: string;
};

export const PAUTA_BRIEFING_KEYS = ["product", "key_message", "must_have", "donts", "cta", "hashtags"] as const;

export const EMPTY_PAUTA_BRIEFING: PautaBriefingFields = {
  product: "",
  key_message: "",
  must_have: "",
  donts: "",
  cta: "",
  hashtags: "",
};

export function emptyPautaBriefing(): PautaBriefingFields {
  return { ...EMPTY_PAUTA_BRIEFING };
}

export function pautaBriefingHasContent(fields?: Partial<PautaBriefingFields> | null) {
  if (!fields) return false;
  return PAUTA_BRIEFING_KEYS.some((key) => String(fields[key] ?? "").trim());
}

export function parsePautaBriefing(item: {
  briefing?: string | null;
  briefing_note?: string | null;
  briefing_fields?: Partial<PautaBriefingFields> | null;
}): PautaBriefingFields {
  const fields = emptyPautaBriefing();
  if (item.briefing_fields && typeof item.briefing_fields === "object") {
    for (const key of PAUTA_BRIEFING_KEYS) {
      fields[key] = String(item.briefing_fields[key] ?? "").trim();
    }
  }
  if (!pautaBriefingHasContent(fields)) {
    fields.product = (item.briefing || item.briefing_note || "").trim();
  }
  return fields;
}

export function pautaBriefingSummary(fields: PautaBriefingFields) {
  const text = PAUTA_BRIEFING_KEYS.map((key) => fields[key].trim()).filter(Boolean).join("\n\n");
  return text || null;
}

export function itemHasPautaBriefing(item: {
  briefing?: string | null;
  briefing_note?: string | null;
  briefing_fields?: Partial<PautaBriefingFields> | null;
}) {
  return pautaBriefingHasContent(parsePautaBriefing(item));
}
