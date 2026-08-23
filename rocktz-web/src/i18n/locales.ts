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

export function localeFromTag(value?: string | null): AppLocale | null {
  if (!value) {
    return null;
  }
  if (isAppLocale(value)) {
    return value;
  }
  const lower = value.toLowerCase().replace(/_/g, "-");
  if (isAppLocale(lower)) {
    return lower;
  }
  if (lower.startsWith("pt")) {
    return "pt-BR";
  }
  if (lower.startsWith("es")) {
    return "es";
  }
  if (lower.startsWith("en")) {
    return "en";
  }
  return null;
}

export function normalizeLocale(value?: string | null): AppLocale {
  return localeFromTag(value) ?? DEFAULT_LOCALE;
}

export function pickLocaleFromLanguages(languages: readonly (string | null | undefined)[]): AppLocale {
  for (const value of languages) {
    const match = localeFromTag(value);
    if (match) {
      return match;
    }
  }
  return DEFAULT_LOCALE;
}

export function readComputerLanguages(): string[] {
  if (typeof navigator === "undefined") {
    return [];
  }
  const found: string[] = [];
  if (Array.isArray(navigator.languages)) {
    found.push(...navigator.languages);
  }
  if (navigator.language) {
    found.push(navigator.language);
  }
  try {
    const osLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (osLocale) {
      found.push(osLocale);
    }
  } catch {
    // ignore
  }
  return found;
}

export const LOCALE_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(LOCALE_STORAGE_KEY)};var stored=localStorage.getItem(k);var langs=stored?[stored]:[];if(!stored){if(navigator.languages)langs=langs.concat(navigator.languages);if(navigator.language)langs.push(navigator.language);try{langs.push(Intl.DateTimeFormat().resolvedOptions().locale)}catch(e){}}var lang=${JSON.stringify(DEFAULT_LOCALE)};for(var i=0;i<langs.length;i++){var v=String(langs[i]||"").toLowerCase().replace(/_/g,"-");if(v==="pt-br"||v.indexOf("pt")===0){lang="pt-BR";break}if(v==="es"||v.indexOf("es")===0){lang="es";break}if(v==="en"||v.indexOf("en")===0){lang="en";break}}document.documentElement.lang=lang}catch(e){}})();`;

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
