export interface ContractSection {
  number: string;
  title: string;
  items: string[];
}

export interface ContractPart {
  id: string;
  partNumber: number;
  partTitle: string;
  badge: string;
  summary: string;
  sections: ContractSection[];
}

export interface ContractDeclarationItem {
  id: string;
  label: string;
  emphasis?: string;
  required: boolean;
}

export interface CreatorContractMetadata {
  title: string;
  subtitle: string;
  version: string;
  lastUpdated: string;
  companyName: string;
  cnpj: string;
  platform: string;
}

export interface CreatorContractContent {
  metadata: CreatorContractMetadata;
  preamble: string;
  parts: ContractPart[];
  declarations: ContractDeclarationItem[];
}

export interface CreatorContractAuditRecord {
  termId: string;
  version: string;
  fullName: string;
  document: string;
  email: string;
  acceptedAt: string;
  formattedDate: string;
  ipUserAgent: string;
  declarations: Record<string, boolean>;
  allAccepted: boolean;
  status: "valid" | "revoked";
}
