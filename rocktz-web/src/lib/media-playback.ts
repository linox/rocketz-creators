import { getApiUrl } from "@/lib/laravel";

export const PLAYER_MAX_BYTES = 200 * 1024 * 1024;

export function isPlayableVideoSize(size?: number | null) {
  return !size || size <= PLAYER_MAX_BYTES;
}

function mediaOrigin(): string {
  return getApiUrl().replace(/\/api\/?$/, "");
}

function objectKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, "http://localhost");
    const pathname = parsed.pathname;
    for (const marker of ["/stream/", "/downloads/", "/uploads/"] as const) {
      if (pathname.includes(marker)) {
        const rest = `${pathname.split(marker)[1] ?? ""}${parsed.search}`;
        return rest || null;
      }
    }

    const host = parsed.hostname.toLowerCase();
    const isR2 =
      host.includes("r2.cloudflarestorage.com") ||
      host.endsWith(".r2.dev") ||
      host === "media.creatorz.digital";
    if (!isR2) return null;

    const segments = pathname.split("/").filter(Boolean);
    const folderAt = segments.findIndex((part) => part === "portfolio" || part === "avatars");
    if (folderAt < 0) return null;
    return segments.slice(folderAt).join("/");
  } catch {
    return null;
  }
}

export function mediaPublicUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  const relative = objectKeyFromUrl(raw);
  if (!relative) return raw;
  return `${mediaOrigin()}/stream/${relative}`;
}

export function mediaStreamUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  const relative = objectKeyFromUrl(raw);
  if (!relative) return raw;
  return `${mediaOrigin()}/stream/${relative}`;
}

export function mediaDownloadUrl(url: string): string {
  const relative = objectKeyFromUrl(url);
  if (!relative) return url;
  return `${mediaOrigin()}/downloads/${relative}`;
}
