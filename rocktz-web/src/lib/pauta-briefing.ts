export type PautaBriefingFields = {
  product: string;
  key_message: string;
  must_have: string;
  donts: string;
  cta: string;
  hashtags: string;
};

/** API / PlanningItem may send null for empty fields. */
export type PautaBriefingFieldsInput = Partial<{
  [K in keyof PautaBriefingFields]: string | null;
}>;

export type PautaBriefingItemLike = {
  briefing?: string | null;
  briefing_note?: string | null;
  briefing_fields?: PautaBriefingFieldsInput | null;
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

export function pautaBriefingHasContent(fields?: PautaBriefingFieldsInput | null) {
  if (!fields) return false;
  return PAUTA_BRIEFING_KEYS.some((key) => String(fields[key] ?? "").trim());
}

export function parsePautaBriefing(item: PautaBriefingItemLike): PautaBriefingFields {
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

export function itemHasPautaBriefing(item: PautaBriefingItemLike) {
  return pautaBriefingHasContent(parsePautaBriefing(item));
}

const LIVE_PAUTA_TYPES = new Set(["live", "live_instagram", "live_tiktok", "live_youtube"]);

export function isLivePautaType(type?: string | null) {
  return Boolean(type && LIVE_PAUTA_TYPES.has(type));
}

/** Generated monthly slot without a brief — creator must wait, not submit. */
export function itemIsAwaitingPauta(item: PautaBriefingItemLike & {
  status?: string | null;
  content_type?: string | null;
}) {
  if (isLivePautaType(item.content_type)) return false;
  return item.status === "planned" && !itemHasPautaBriefing(item);
}

/** Real pauta name, ignoring auto titles like "Reel 1/4". */
export function namedPautaTitle(title?: string | null) {
  const value = (title ?? "").trim();
  if (!value) return "";
  if (/\s+\d+\/\d+$/.test(value)) return "";
  return value;
}

export function creatorPautaHeading(title: string | null | undefined, awaitingLabel: string) {
  return namedPautaTitle(title) || awaitingLabel;
}
