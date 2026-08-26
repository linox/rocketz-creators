import { AUTH_COOKIE, homePathForUser, type AuthPayload, type AuthUser } from "@/lib/auth";
import i18n, { getAppLocale } from "@/i18n/config";
import { cacheAuthUser, clearSessionCache } from "@/lib/session-cache";

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const PRODUCTION_API_URL = "https://api.creatorz.digital/api";
const PRODUCTION_HOSTS = new Set(["creatorz.digital", "www.creatorz.digital"]);

function isLocalAccessHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

export function getApiUrl(): string {
  if (typeof window === "undefined") {
    return DEFAULT_API_URL;
  }
  const host = window.location.hostname;
  if (isLocalAccessHost(host)) {
    return `http://${host}:8000/api`;
  }
  if (PRODUCTION_HOSTS.has(host)) {
    return PRODUCTION_API_URL;
  }
  return DEFAULT_API_URL;
}

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

export function consumeAuthHash(): {
  token: string | null;
  google: string | null;
  intent: string | null;
  signup: string | null;
  twoFactor: string | null;
  challenge: string | null;
  emailHint: string | null;
} {
  if (typeof window === "undefined") {
    return { token: null, google: null, intent: null, signup: null, twoFactor: null, challenge: null, emailHint: null };
  }

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = hash.get("token");
  const google = hash.get("google");
  const intent = hash.get("intent");
  const signup = hash.get("signup");
  const twoFactor = hash.get("two_factor");
  const challenge = hash.get("challenge");
  const emailHint = hash.get("email_hint");
  if (token || google || twoFactor || challenge) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  return { token, google, intent, signup, twoFactor, challenge, emailHint };
}

export function clearToken() {
  localStorage.removeItem(AUTH_COOKIE);
  clearSessionCache();
}

export function persistAuth(payload: AuthPayload, afterSignup = false): string {
  setToken(payload.token);
  cacheAuthUser(payload.user);
  if (afterSignup && payload.user.role === "creator" && payload.user.creator?.id) {
    return `/creators/${payload.user.creator.id}?tab=portfolio`;
  }
  return homePathForUser(payload.user);
}

export type UploadProgressHandler = (percent: number) => void;

const CHUNK_THRESHOLD_BYTES = 2 * 1024 * 1024;
const CHUNK_CONCURRENCY = 4;
const CHUNK_RETRIES = 3;

export async function laravelUpload<T>(
  path: string,
  body: FormData,
  onProgress?: UploadProgressHandler,
): Promise<T> {
  const file = body.get("file");
  if (path === "/media" && file instanceof Blob && file.size >= CHUNK_THRESHOLD_BYTES) {
    const filename = file instanceof File && file.name ? file.name : "file.bin";
    return laravelChunkedUpload<T>(file, filename, onProgress);
  }

  return xhrSend<T>("POST", `${getApiUrl()}${path}`, body, onProgress);
}

async function laravelChunkedUpload<T>(
  file: Blob,
  filename: string,
  onProgress?: UploadProgressHandler,
): Promise<T> {
  const session = await laravelFetch<{ data: { id: string; chunk_size: number; total_chunks: number } }>("/media/uploads", {
    method: "POST",
    body: JSON.stringify({
      filename,
      size: file.size,
      mime_type: file.type || "",
    }),
  });

  const { id, chunk_size: chunkSize, total_chunks: totalChunks } = session.data;
  const uploaded = new Array<number>(totalChunks).fill(0);
  const report = () => {
    if (!onProgress) return;
    const loaded = uploaded.reduce((sum, value) => sum + value, 0);
    onProgress(Math.min(99, Math.round((loaded / file.size) * 100)));
  };

  const sendChunk = async (index: number) => {
    const start = index * chunkSize;
    const chunk = file.slice(start, Math.min(start + chunkSize, file.size));
    let attempt = 0;
    while (true) {
      try {
        await xhrSend<{ data: { index: number } }>(
          "POST",
          `${getApiUrl()}/media/uploads/${id}/chunks/${index}`,
          chunk,
          (percent) => {
            uploaded[index] = Math.round((percent / 100) * chunk.size);
            report();
          },
          "application/octet-stream",
        );
        uploaded[index] = chunk.size;
        report();
        return;
      } catch (error) {
        attempt += 1;
        if (attempt >= CHUNK_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  };

  const pending = Array.from({ length: totalChunks }, (_, index) => index);
  const workers = Array.from({ length: Math.min(CHUNK_CONCURRENCY, totalChunks) }, async () => {
    while (pending.length > 0) {
      const index = pending.shift();
      if (index === undefined) return;
      await sendChunk(index);
    }
  });
  await Promise.all(workers);

  const completed = await laravelFetch<T>(`/media/uploads/${id}`, { method: "POST" });
  onProgress?.(100);
  return completed;
}

function xhrSend<T>(
  method: string,
  url: string,
  body: FormData | Blob,
  onProgress?: UploadProgressHandler,
  contentType?: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.responseType = "text";
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Accept-Language", getAppLocale());
    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }

    const token = getToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("X-Auth-Token", token);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      const data = parseLaravelJson<T>(xhr.responseText);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(data.message ?? i18n.t("common:alerts.tryAgain"), xhr.status, data.errors));
        return;
      }
      onProgress?.(100);
      resolve(data as T);
    };

    xhr.onerror = () => {
      reject(new ApiError(i18n.t("common:alerts.tryAgain"), 0));
    };

    xhr.onabort = () => {
      reject(new ApiError(i18n.t("common:alerts.tryAgain"), 0));
    };

    xhr.send(body);
  });
}

function parseLaravelJson<T>(raw: string): T & LaravelError {
  try {
    return JSON.parse(raw || "{}") as T & LaravelError;
  } catch {
    return {} as T & LaravelError;
  }
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

  const response = await fetch(`${getApiUrl()}${path}`, {
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
  cacheAuthUser(data.user);
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
  return `${getApiUrl()}/auth/google/redirect?intent=${encodeURIComponent(intent)}`;
}
