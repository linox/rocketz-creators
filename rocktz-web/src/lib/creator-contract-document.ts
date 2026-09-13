import { getCreatorContract, type CreatorContractAuditRecord } from "@/data/creatorContractTerms";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import type { Creator } from "@/lib/types";

export type CreatorTermDocLabels = {
  signed: string;
  pending: string;
  artisticName: string;
  fullName: string;
  document: string;
  email: string;
  acceptedAt: string;
  version: string;
  acceptId: string;
  declarations: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function creatorTermFileSlug(creator: Creator): string {
  const raw = creator.artistic_name || creator.full_name || String(creator.id);
  const slug = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || `criador-${creator.id}`;
}

export function creatorTermAudit(creator: Creator, locale?: string | null): CreatorContractAuditRecord | null {
  const acceptance = creator.contract_acceptance;
  if (!acceptance) return null;

  const dateLocale = intlLocale(normalizeLocale(locale));
  const acceptedAt = acceptance.accepted_at || "";
  const formattedDate = acceptedAt
    ? new Date(acceptedAt).toLocaleString(dateLocale)
    : "";
  const contract = getCreatorContract(locale);
  const stored = acceptance.declarations ?? {};
  const hasItemFlags = Object.keys(stored).some((key) => key !== "all");
  const allAccepted = Boolean(acceptance.all_accepted || stored.all);
  const declarations = hasItemFlags
    ? stored
    : Object.fromEntries(contract.declarations.map((item) => [item.id, allAccepted]));

  return {
    termId: `RC-${acceptance.id}`,
    version: acceptance.version || contract.metadata.version,
    fullName: acceptance.full_name || creator.full_name || "",
    document: acceptance.document || creator.document || creator.cpf || "",
    email: acceptance.email || creator.email || "",
    acceptedAt,
    formattedDate,
    ipUserAgent: [acceptance.ip, acceptance.user_agent].filter(Boolean).join(" · "),
    declarations,
    allAccepted,
    status: acceptance.status === "revoked" ? "revoked" : "valid",
  };
}

export function downloadCreatorTermDocument(creator: Creator, locale: string | null | undefined, labels: CreatorTermDocLabels): void {
  const contract = getCreatorContract(locale);
  const audit = creatorTermAudit(creator, locale);
  const fullName = audit?.fullName || creator.full_name || "";
  const taxDocument = audit?.document || creator.document || creator.cpf || "";
  const email = audit?.email || creator.email || "";
  const signed = Boolean(audit);

  const partsHtml = contract.parts
    .map((part) => {
      const sections = part.sections
        .map(
          (section) => `
            <section>
              <h3>${escapeHtml(section.number)}. ${escapeHtml(section.title)}</h3>
              ${section.items.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
            </section>`,
        )
        .join("");
      return `
        <article>
          <h2>${escapeHtml(String(part.partNumber))}. ${escapeHtml(part.partTitle)}</h2>
          ${sections}
        </article>`;
    })
    .join("");

  const declarationsHtml = contract.declarations
    .map((item) => `<li>${escapeHtml(item.label)}</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(normalizeLocale(locale))}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(contract.metadata.title)} — ${escapeHtml(creator.artistic_name)}</title>
  <style>
    body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #0f172a; max-width: 820px; margin: 32px auto; padding: 0 20px 64px; line-height: 1.55; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 2px solid #c4b5fd; padding-bottom: 0.35rem; }
    h3 { font-size: 0.95rem; margin-top: 1.25rem; }
    p { white-space: pre-line; font-size: 0.9rem; color: #334155; }
    .meta { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 18px; margin: 20px 0; font-size: 0.85rem; }
    .meta dt { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.04em; }
    .meta dd { margin: 0 0 10px; font-weight: 600; }
    .badge { display: inline-block; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 8px; border-radius: 999px; }
    .signed { background: #ecfdf5; color: #047857; }
    .pending { background: #fffbeb; color: #b45309; }
  </style>
</head>
<body>
  <span class="badge ${signed ? "signed" : "pending"}">${escapeHtml(signed ? labels.signed : labels.pending)}</span>
  <h1>${escapeHtml(contract.metadata.title)}</h1>
  <p>${escapeHtml(contract.metadata.subtitle)} · ${escapeHtml(labels.version)} ${escapeHtml(contract.metadata.version)}</p>
  <p>${escapeHtml(contract.metadata.companyName)} · CNPJ ${escapeHtml(contract.metadata.cnpj)}</p>
  <dl class="meta">
    <dt>${escapeHtml(labels.artisticName)}</dt><dd>@${escapeHtml(creator.artistic_name)}</dd>
    <dt>${escapeHtml(labels.fullName)}</dt><dd>${escapeHtml(fullName || "—")}</dd>
    <dt>${escapeHtml(labels.document)}</dt><dd>${escapeHtml(taxDocument || "—")}</dd>
    <dt>${escapeHtml(labels.email)}</dt><dd>${escapeHtml(email || "—")}</dd>
    <dt>${escapeHtml(labels.acceptedAt)}</dt><dd>${escapeHtml(audit?.formattedDate || "—")}</dd>
    <dt>${escapeHtml(labels.acceptId)}</dt><dd>${escapeHtml(audit?.termId || "—")}</dd>
  </dl>
  <p>${escapeHtml(contract.preamble)}</p>
  ${partsHtml}
  <h2>${escapeHtml(labels.declarations)}</h2>
  <ul>${declarationsHtml}</ul>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const page = globalThis.document;
  const link = page.createElement("a");
  link.href = url;
  link.download = `termo-adesao-${creatorTermFileSlug(creator)}.html`;
  page.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
