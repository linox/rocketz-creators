import type { AuthUser } from "@/lib/auth";

const USER_STORAGE_KEY = "rocktz.session.user";
const USER_TTL_MS = 45_000;
const NAV_TTL_MS = 30_000;

export type NavBadges = {
  unread: number;
  pending_applications: number;
};

let memoryUser: AuthUser | null = null;
let userCachedAt = 0;
let memoryNav: NavBadges | null = null;
let navCachedAt = 0;

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function peekMemoryUser(): AuthUser | null {
  return memoryUser;
}

export function peekCachedUser(): AuthUser | null {
  if (memoryUser) return memoryUser;
  const stored = readStoredUser();
  if (stored) memoryUser = stored;
  return stored;
}

export function isUserCacheFresh(): boolean {
  return Boolean(memoryUser) && Date.now() - userCachedAt < USER_TTL_MS;
}

export function cacheAuthUser(user: AuthUser) {
  memoryUser = user;
  userCachedAt = Date.now();
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota */
  }
}

export function peekNavBadges(): NavBadges | null {
  return memoryNav;
}

export function isNavCacheFresh(): boolean {
  return Boolean(memoryNav) && Date.now() - navCachedAt < NAV_TTL_MS;
}

export function cacheNavBadges(badges: NavBadges) {
  memoryNav = badges;
  navCachedAt = Date.now();
}

export function invalidateNavBadges() {
  navCachedAt = 0;
}

export function emitNavRefresh() {
  invalidateNavBadges();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("rocketz:nav-refresh"));
}

export function emitAuthRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("rocketz:auth-refresh"));
}

export function clearSessionCache() {
  memoryUser = null;
  userCachedAt = 0;
  memoryNav = null;
  navCachedAt = 0;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
