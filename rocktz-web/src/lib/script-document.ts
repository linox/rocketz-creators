import { api } from "@/lib/api";

export const MAX_SCRIPT_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const SCRIPT_DOCUMENT_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SCRIPT_DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx"]);

export type ScriptDocumentRef = {
  url: string;
  filename: string;
};

export function scriptDocumentExtension(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function isScriptDocumentFile(file: File) {
  const ext = scriptDocumentExtension(file.name);
  if (!SCRIPT_DOCUMENT_EXTENSIONS.has(ext)) return false;
  if (file.size > MAX_SCRIPT_DOCUMENT_BYTES) return false;
  return true;
}

export function parseScriptDocument(url?: string | null, filename?: string | null): ScriptDocumentRef | null {
  const nextUrl = (url ?? "").trim();
  if (!nextUrl) return null;
  const nextName = (filename ?? "").trim() || "roteiro.pdf";
  return { url: nextUrl, filename: nextName };
}

export function briefingScriptDocument(briefing?: Record<string, unknown> | null): ScriptDocumentRef | null {
  if (!briefing || typeof briefing !== "object") return null;
  return parseScriptDocument(
    typeof briefing.script_file_url === "string" ? briefing.script_file_url : null,
    typeof briefing.script_file_name === "string" ? briefing.script_file_name : null,
  );
}

export async function uploadScriptDocument(file: File): Promise<ScriptDocumentRef> {
  const uploaded = await api.uploadMedia(file, file.name);
  return { url: uploaded.data.url, filename: file.name };
}
