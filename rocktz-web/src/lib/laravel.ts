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

export class UploadCancelledError extends ApiError {
  constructor() {
    super(i18n.t("profile:uploadCancelled"), 499);
  }
}

export function isUploadCancelled(err: unknown): boolean {
  return err instanceof UploadCancelledError;
}

const abortedUploads = new Set<string>();
const activeXhrs = new Map<string, Set<XMLHttpRequest>>();

function isUploadAborted(uploadId?: string) {
  return Boolean(uploadId && abortedUploads.has(uploadId));
}

function trackXhr(uploadId: string | undefined, xhr: XMLHttpRequest) {
  if (!uploadId) return;
  let group = activeXhrs.get(uploadId);
  if (!group) {
    group = new Set();
    activeXhrs.set(uploadId, group);
  }
  group.add(xhr);
}

function untrackXhr(uploadId: string | undefined, xhr: XMLHttpRequest) {
  if (!uploadId) return;
  const group = activeXhrs.get(uploadId);
  if (!group) return;
  group.delete(xhr);
  if (group.size === 0) activeXhrs.delete(uploadId);
}

export function abortMediaUploadClient(uploadId: string) {
  abortedUploads.add(uploadId);
  const group = activeXhrs.get(uploadId);
  if (!group) return;
  for (const xhr of group) {
    xhr.abort();
  }
  activeXhrs.delete(uploadId);
}

export function clearUploadAbort(uploadId: string) {
  abortedUploads.delete(uploadId);
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

export type MediaUploadStatusValue = "uploading" | "processing" | "done" | "failed";

export type MediaUploadState = {
  status: MediaUploadStatusValue;
  progress?: number;
  message?: string;
  data?: { id: number; url: string; filename: string; path: string; size?: number };
};

export type SubmissionUploadMeta = {
  type: "campaign_creator" | "content_planning_item";
  id: number;
  payload: Record<string, unknown>;
  label: string;
};

const CHUNK_THRESHOLD_BYTES = 2 * 1024 * 1024;
const CHUNK_CONCURRENCY = 2;
const CHUNK_RETRIES = 5;
const CHUNK_TIMEOUT_MS = 180_000;
const UPLOAD_POLL_MS = 2000;
const UPLOAD_TIMEOUT_MS = 600_000;

export async function laravelUpload<T>(
  path: string,
  body: FormData,
  onProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): Promise<T> {
  const file = body.get("file");
  if (path === "/media" && file instanceof Blob && file.size >= CHUNK_THRESHOLD_BYTES) {
    const filename = file instanceof File && file.name ? file.name : "file.bin";
    return laravelChunkedUpload<T>(file, filename, onProgress, signal);
  }

  return xhrSend<T>("POST", `${getApiUrl()}${path}`, body, onProgress, undefined, undefined, signal);
}

type MediaUploadInit = {
  id: string;
  chunk_size: number;
  total_chunks: number;
  async: boolean;
  destination: "api" | "r2";
  part_urls: string[];
};

type MediaUploadPart = { index: number; etag: string };

export async function initMediaUpload(
  file: Blob,
  filename: string,
  submission?: Pick<SubmissionUploadMeta, "type" | "id" | "payload">,
  signal?: AbortSignal,
) {
  return laravelFetch<{ data: MediaUploadInit }>("/media/uploads", {
    method: "POST",
    body: JSON.stringify({
      filename,
      size: file.size,
      mime_type: file.type || "",
      ...(submission ? { submission } : {}),
    }),
    signal,
  });
}

export async function completeMediaUpload(uploadId: string, parts?: MediaUploadPart[]) {
  return laravelFetch<{ data: MediaUploadState }>(`/media/uploads/${uploadId}`, {
    method: "POST",
    body: JSON.stringify(parts ? { parts } : {}),
  });
}

export async function laravelSubmissionUpload(
  file: Blob,
  filename: string,
  submission: SubmissionUploadMeta,
  onProgress?: UploadProgressHandler,
): Promise<MediaUploadState> {
  const session = await initMediaUpload(file, filename, submission);
  const { id: uploadId, chunk_size: chunkSize, total_chunks: totalChunks, part_urls: partUrls } = session.data;
  const parts = await runUploadChunks(file, uploadId, chunkSize, totalChunks, onProgress, partUrls);
  const started = await completeMediaUpload(uploadId, parts);
  return waitForMediaUpload(uploadId, started.data, onProgress);
}

async function laravelChunkedUpload<T>(
  file: Blob,
  filename: string,
  onProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw new UploadCancelledError();
  }

  const session = await laravelFetch<{ data: MediaUploadInit }>("/media/uploads", {
    method: "POST",
    body: JSON.stringify({
      filename,
      size: file.size,
      mime_type: file.type || "",
    }),
    signal,
  });

  const { id, chunk_size: chunkSize, total_chunks: totalChunks, part_urls: partUrls } = session.data;
  if (signal?.aborted) {
    await cancelMediaUpload(id).catch(() => undefined);
    throw new UploadCancelledError();
  }
  signal?.addEventListener("abort", () => {
    void cancelMediaUpload(id).catch(() => undefined);
  }, { once: true });

  const parts = await runUploadChunks(file, id, chunkSize, totalChunks, onProgress, partUrls);

  if (isUploadAborted(id) || signal?.aborted) {
    throw new UploadCancelledError();
  }

  const completed = await laravelFetch<T>(`/media/uploads/${id}`, {
    method: "POST",
    body: JSON.stringify(parts ? { parts } : {}),
  });
  onProgress?.(100);
  return completed;
}

async function runUploadChunks(
  file: Blob,
  uploadId: string,
  chunkSize: number,
  totalChunks: number,
  onProgress?: UploadProgressHandler,
  partUrls?: string[],
): Promise<MediaUploadPart[] | undefined> {
  const uploaded = new Array<number>(totalChunks).fill(0);
  const report = () => {
    if (!onProgress) return;
    const loaded = uploaded.reduce((sum, value) => sum + value, 0);
    onProgress(Math.min(90, Math.round((loaded / file.size) * 90)));
  };

  const etags = new Array<string>(totalChunks).fill("");
  const sendChunk = async (index: number) => {
    if (isUploadAborted(uploadId)) {
      throw new UploadCancelledError();
    }
    const start = index * chunkSize;
    const chunk = file.slice(start, Math.min(start + chunkSize, file.size));
    const directUrl = partUrls?.[index];
    let attempt = 0;
    while (true) {
      try {
        if (directUrl) {
          etags[index] = await xhrPutPresigned(
            directUrl,
            chunk,
            uploadId,
            (percent) => {
              uploaded[index] = Math.round((percent / 100) * chunk.size);
              report();
            },
          );
        } else {
          await xhrSend<{ data: { index: number } }>(
            "POST",
            `${getApiUrl()}/media/uploads/${uploadId}/chunks/${index}`,
            chunk,
            (percent) => {
              uploaded[index] = Math.round((percent / 100) * chunk.size);
              report();
            },
            "application/octet-stream",
            uploadId,
          );
        }
        uploaded[index] = chunk.size;
        report();
        return;
      } catch (error) {
        if (error instanceof UploadCancelledError || isUploadAborted(uploadId)) {
          throw error instanceof UploadCancelledError ? error : new UploadCancelledError();
        }
        attempt += 1;
        if (attempt >= CHUNK_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  };

  const pending = Array.from({ length: totalChunks }, (_, index) => index);
  const workers = Array.from({ length: Math.min(CHUNK_CONCURRENCY, totalChunks) }, async () => {
    while (pending.length > 0) {
      if (isUploadAborted(uploadId)) {
        throw new UploadCancelledError();
      }
      const index = pending.shift();
      if (index === undefined) return;
      await sendChunk(index);
    }
  });
  await Promise.all(workers);

  if (!partUrls?.length) return undefined;
  return etags.map((etag, index) => ({ index, etag }));
}

export async function runMediaUploadChunks(
  file: Blob,
  uploadId: string,
  chunkSize: number,
  totalChunks: number,
  onProgress?: UploadProgressHandler,
  partUrls?: string[],
) {
  return runUploadChunks(file, uploadId, chunkSize, totalChunks, onProgress, partUrls);
}

export async function getMediaUploadStatus(uploadId: string): Promise<MediaUploadState> {
  const response = await laravelFetch<{ data: MediaUploadState }>(`/media/uploads/${uploadId}`);
  return response.data;
}

export async function waitForMediaUpload(
  uploadId: string,
  started: MediaUploadState,
  onProgress?: UploadProgressHandler,
): Promise<MediaUploadState> {
  let current = started;
  const began = Date.now();

  while (current.status === "uploading" || current.status === "processing") {
    if (isUploadAborted(uploadId)) {
      throw new UploadCancelledError();
    }
    if (Date.now() - began > UPLOAD_TIMEOUT_MS) {
      throw new ApiError(i18n.t("profile:uploadTimeout"), 408);
    }
    if (typeof current.progress === "number") {
      onProgress?.(current.progress);
    }
    await new Promise((resolve) => setTimeout(resolve, UPLOAD_POLL_MS));
    current = await getMediaUploadStatus(uploadId);
  }

  if (current.status === "failed") {
    throw new ApiError(current.message ?? i18n.t("common:alerts.tryAgain"), 422);
  }

  onProgress?.(100);
  return current;
}

export async function cancelMediaUpload(uploadId: string) {
  abortMediaUploadClient(uploadId);
  try {
    return await laravelFetch<{ message: string }>(`/media/uploads/${uploadId}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
      return { message: i18n.t("profile:uploadCancelled") };
    }
    throw error;
  }
}

function xhrPutPresigned(
  url: string,
  body: Blob,
  uploadId: string,
  onProgress?: UploadProgressHandler,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (isUploadAborted(uploadId)) {
      reject(new UploadCancelledError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    const finish = () => untrackXhr(uploadId, xhr);

    trackXhr(uploadId, xhr);

    xhr.onload = () => {
      finish();
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(i18n.t("common:alerts.tryAgain"), xhr.status));
        return;
      }
      const etag = xhr.getResponseHeader("ETag") || xhr.getResponseHeader("etag");
      if (!etag) {
        reject(new ApiError(i18n.t("common:alerts.tryAgain"), 500));
        return;
      }
      resolve(etag);
    };

    xhr.onerror = () => {
      finish();
      reject(new ApiError(i18n.t("common:alerts.tryAgain"), 0));
    };

    xhr.onabort = () => {
      finish();
      reject(new UploadCancelledError());
    };

    xhr.timeout = CHUNK_TIMEOUT_MS;
    xhr.ontimeout = () => {
      finish();
      reject(new ApiError(i18n.t("profile:uploadTimeout"), 408));
    };

    xhr.send(body);
  });
}

function xhrSend<T>(
  method: string,
  url: string,
  body: FormData | Blob,
  onProgress?: UploadProgressHandler,
  contentType?: string,
  uploadId?: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted || isUploadAborted(uploadId)) {
      reject(new UploadCancelledError());
      return;
    }

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

    const finish = () => {
      untrackXhr(uploadId, xhr);
      signal?.removeEventListener("abort", onSignalAbort);
    };

    function onSignalAbort() {
      xhr.abort();
    }

    trackXhr(uploadId, xhr);
    signal?.addEventListener("abort", onSignalAbort, { once: true });

    xhr.onload = () => {
      finish();
      const data = parseLaravelJson<T>(xhr.responseText);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(data.message ?? i18n.t("common:alerts.tryAgain"), xhr.status, data.errors));
        return;
      }
      onProgress?.(100);
      resolve(data as T);
    };

    xhr.onerror = () => {
      finish();
      reject(new ApiError(i18n.t("common:alerts.tryAgain"), 0));
    };

    xhr.onabort = () => {
      finish();
      reject(new UploadCancelledError());
    };

    xhr.timeout = CHUNK_TIMEOUT_MS;
    xhr.ontimeout = () => {
      finish();
      reject(new ApiError(i18n.t("profile:uploadTimeout"), 408));
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

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new UploadCancelledError();
    }
    throw error;
  }

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
