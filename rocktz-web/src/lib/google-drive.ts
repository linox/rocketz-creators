import { safeHttpUrl } from "@/lib/safe-http-url";

export function isGoogleDriveUrl(value?: string | null): boolean {
  const href = safeHttpUrl(value);
  if (!href) return false;
  try {
    const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    return host === "drive.google.com" || host === "docs.google.com";
  } catch {
    return false;
  }
}
