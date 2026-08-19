export const LOCALES = ["pt-BR", "en", "es"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "pt-BR";

export const LOCALE_STORAGE_KEY = "rocktz_locale";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  "pt-BR": "PT",
  en: "EN",
  es: "ES",
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "pt-BR" || value === "en" || value === "es";
}

export function normalizeLocale(value?: string | null): AppLocale {
  if (!value) {
    return DEFAULT_LOCALE;
  }
  if (isAppLocale(value)) {
    return value;
  }
  const lower = value.toLowerCase().replace("_", "-");
  if (lower.startsWith("pt")) {
    return "pt-BR";
  }
  if (lower.startsWith("es")) {
    return "es";
  }
  if (lower.startsWith("en")) {
    return "en";
  }
  return DEFAULT_LOCALE;
}

export function toLaravelLocale(locale: AppLocale): string {
  return locale === "pt-BR" ? "pt_BR" : locale;
}

export function intlLocale(locale: AppLocale): string {
  if (locale === "en") {
    return "en-US";
  }
  if (locale === "es") {
    return "es-ES";
  }
  return "pt-BR";
}
