import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

const LANDING_SLUG_KEY = "rocketz:landing_slug";

export function setLandingOrigin(slug: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LANDING_SLUG_KEY, slug);
}

export function getLandingOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(LANDING_SLUG_KEY)?.trim();
  return value || null;
}

export function clearLandingOrigin() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LANDING_SLUG_KEY);
}

export function companyLandingPath(slug: string) {
  return `/l/${slug}`;
}

export async function attachLandingOrigin(user?: AuthUser | null) {
  const slug = getLandingOrigin();
  if (!slug || user?.role !== "creator") return;
  try {
    await api.claimLanding(slug);
    clearLandingOrigin();
  } catch {
    /* keep slug so a later retry can attach the origin */
  }
}
