import { getApiUrl } from "@/lib/laravel";

export const PLAYER_MAX_BYTES = 200 * 1024 * 1024;

export function isPlayableVideoSize(size?: number | null) {
  return !size || size <= PLAYER_MAX_BYTES;
}

export function mediaDownloadUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const marker = "/uploads/";
    if (path.includes(marker)) {
      const relative = path.split(marker)[1];
      const base = getApiUrl().replace(/\/api\/?$/, "");
      return `${base}/downloads/${relative}`;
    }
  } catch {
    /* ignore */
  }
  return url;
}
