import { creatorContractEn } from "@/data/creatorContract/en";
import { creatorContractEs } from "@/data/creatorContract/es";
import { creatorContractPt } from "@/data/creatorContract/pt-BR";
import type { AppLocale } from "@/i18n/locales";
import { normalizeLocale } from "@/i18n/locales";
import type { CreatorContractContent } from "@/data/creatorContract/types";

export type {
  ContractDeclarationItem,
  ContractPart,
  ContractSection,
  CreatorContractAuditRecord,
  CreatorContractContent,
  CreatorContractMetadata,
} from "@/data/creatorContract/types";

const BY_LOCALE: Record<AppLocale, CreatorContractContent> = {
  "pt-BR": creatorContractPt,
  en: creatorContractEn,
  es: creatorContractEs,
};

function interpolateTaxDocs(content: CreatorContractContent, taxDocs: string): CreatorContractContent {
  const replace = (value: string) => value.replaceAll("{{TAX_DOCS}}", taxDocs);
  return {
    ...content,
    preamble: replace(content.preamble),
    parts: content.parts.map((part) => ({
      ...part,
      sections: part.sections.map((section) => ({
        ...section,
        items: section.items.map(replace),
      })),
    })),
  };
}

const DEFAULT_TAX_DOCS: Record<AppLocale, string> = {
  "pt-BR": "CPF ou CNPJ",
  en: "CPF or CNPJ",
  es: "CPF o CNPJ",
};

export function getCreatorContract(locale?: string | null, taxDocs?: string | null): CreatorContractContent {
  const normalized = normalizeLocale(locale);
  return interpolateTaxDocs(BY_LOCALE[normalized], taxDocs || DEFAULT_TAX_DOCS[normalized]);
}

/** Shared identifiers (language-independent). */
export const CONTRACT_METADATA = {
  version: creatorContractPt.metadata.version,
  companyName: creatorContractPt.metadata.companyName,
  cnpj: creatorContractPt.metadata.cnpj,
  platform: creatorContractPt.metadata.platform,
  title: creatorContractPt.metadata.title,
  subtitle: creatorContractPt.metadata.subtitle,
  lastUpdated: creatorContractPt.metadata.lastUpdated,
};
