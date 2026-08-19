import { AUTH_COOKIE, homePathForUser, type AuthPayload, type AuthUser } from "@/lib/auth";
import i18n, { getAppLocale } from "@/i18n/config";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type LaravelError = {
  message?: string;
  errors?: Record<string, string[]>;
};

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(AUTH_COOKIE);
}

export function setToken(token: string) {
  localStorage.setItem(AUTH_COOKIE, token);
}

export function clearToken() {
  localStorage.removeItem(AUTH_COOKIE);
}

export function persistAuth(payload: AuthPayload): string {
  setToken(payload.token);
  return homePathForUser(payload.user);
}

export async function laravelFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Accept-Language", getAppLocale());

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Auth-Token", token);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as T & LaravelError;

  if (!response.ok) {
    throw new ApiError(data.message ?? i18n.t("common:alerts.tryAgain"), response.status, data.errors);
  }

  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await laravelFetch<{ user: AuthUser }>("/auth/me");
  return data.user;
}

export async function loginRequest(email: string, password: string): Promise<AuthPayload> {
  return laravelFetch<AuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function requestPasswordReset(email: string) {
  return laravelFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function logoutRequest() {
  await laravelFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
  clearToken();
}

export function googleRedirectUrl(intent = "login") {
  return `${API_URL}/auth/google/redirect?intent=${encodeURIComponent(intent)}`;
}
