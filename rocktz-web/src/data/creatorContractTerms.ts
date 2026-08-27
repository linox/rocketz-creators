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

export function getCreatorContract(locale?: string | null): CreatorContractContent {
  return BY_LOCALE[normalizeLocale(locale)];
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
