import { getApiUrl } from "@/lib/laravel";

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
    const folderAt = segments.findIndex((part) => part === "portfolio" || part === "avatars" || part === "documents");
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
  if (relative.startsWith("documents/") || relative.toLowerCase().endsWith(".pdf")) {
    return `${mediaOrigin()}/downloads/${relative}`;
  }
  return `${mediaOrigin()}/stream/${relative}`;
}

export function videoMimeFromUrl(url: string): string {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

export function mediaStreamUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  const relative = objectKeyFromUrl(raw);
  if (!relative) return raw.replace(/\.(mov|qt|m4v)$/i, ".mp4");
  return `${mediaOrigin()}/stream/${relative.replace(/\.(mov|qt|m4v)$/i, ".mp4")}`;
}

export function mediaOriginalStreamUrl(url?: string | null): string | null {
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

export function canPlayNativeMov(): boolean {
  if (typeof document === "undefined") return false;
  const video = document.createElement("video");
  return ["video/mp4; codecs=\"hvc1\"", "video/mp4; codecs=\"hev1\"", "video/quicktime"].some(
    (type) => video.canPlayType(type) !== "",
  );
}

export type PlaybackSource = {
  src: string | null;
  original: string | null;
  preparing: boolean;
};

export async function fetchPlaybackSource(url: string): Promise<PlaybackSource> {
  const stream = mediaStreamUrl(url);
  const fallbackOriginal = mediaOriginalStreamUrl(url);
  if (!stream) {
    return { src: null, original: fallbackOriginal, preparing: false };
  }
  const separator = stream.includes("?") ? "&" : "?";
  try {
    const response = await fetch(`${stream}${separator}source=1`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as PlaybackSource;
    if (!response.ok) {
      return { src: null, original: fallbackOriginal, preparing: true };
    }
    return {
      src: data.src || null,
      original: data.original || fallbackOriginal,
      preparing: Boolean(data.preparing),
    };
  } catch {
    return { src: stream, original: fallbackOriginal, preparing: false };
  }
}
