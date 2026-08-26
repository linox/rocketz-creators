import { getApiUrl } from "@/lib/laravel";

export const PLAYER_MAX_BYTES = 200 * 1024 * 1024;

export function isPlayableVideoSize(size?: number | null) {
  return !size || size <= PLAYER_MAX_BYTES;
}

function uploadsRelativePath(url: string): string | null {
  try {
    const parsed = new URL(url, "http://localhost");
    const marker = parsed.pathname.includes("/stream/") ? "/stream/" : parsed.pathname.includes("/downloads/") ? "/downloads/" : "/uploads/";
    if (!parsed.pathname.includes(marker)) return null;
    return `${parsed.pathname.split(marker)[1] ?? ""}${parsed.search}`;
  } catch {
    return null;
  }
}

function mediaOrigin(): string {
  return getApiUrl().replace(/\/api\/?$/, "");
}

export function mediaPublicUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  const relative = uploadsRelativePath(raw);
  if (!relative) return raw;
  return `${mediaOrigin()}/uploads/${relative}`;
}

export function mediaStreamUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  const relative = uploadsRelativePath(raw);
  if (!relative) return raw;
  return `${mediaOrigin()}/stream/${relative}`;
}

export function mediaDownloadUrl(url: string): string {
  const relative = uploadsRelativePath(url);
  if (!relative) return url;
  return `${mediaOrigin()}/downloads/${relative}`;
}
