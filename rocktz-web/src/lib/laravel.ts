import { AUTH_COOKIE, type AuthPayload, type AuthUser } from "@/lib/auth";

const API_URL = process.env.LARAVEL_API_URL ?? "http://localhost:8000/api";

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

export async function laravelFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as T & LaravelError;

  if (!response.ok) {
    throw new ApiError(data.message ?? "Não foi possível concluir a requisição.", response.status, data.errors);
  }

  return data;
}

export function cookieOptions() {
  return {
    name: AUTH_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const data = await laravelFetch<{ user: AuthUser }>("/auth/me", { token });
  return data.user;
}

export async function loginRequest(email: string, password: string): Promise<AuthPayload> {
  return laravelFetch<AuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
