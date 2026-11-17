import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import i18n from "@/i18n/config";
import { ApiError, isUploadCancelled } from "@/lib/laravel";

function base() {
  return {
    confirmButtonColor: "#7c3aed",
    confirmButtonText: i18n.t("common:gotIt"),
    buttonsStyling: true,
    heightAuto: false,
    customClass: {
      popup: "rounded-3xl font-sans",
      title: "text-slate-900 font-extrabold",
      htmlContainer: "text-slate-600",
      confirmButton: "rounded-xl px-5 py-2.5 font-bold",
      cancelButton: "rounded-xl px-5 py-2.5 font-bold",
    },
  };
}

export function alertError(title: string, text?: string) {
  return Swal.fire({
    ...base(),
    icon: "error",
    title,
    text,
  });
}

export function alertWarning(title: string, text?: string) {
  return Swal.fire({
    ...base(),
    icon: "warning",
    title,
    text,
  });
}

function escapeAlertHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function alertWarningLink(options: {
  title: string;
  text: string;
  href: string;
  linkLabel: string;
}): Promise<boolean> {
  const href = escapeAlertHtml(options.href);
  const result = await Swal.fire({
    ...base(),
    icon: "warning",
    title: options.title,
    html: `<p class="m-0">${escapeAlertHtml(options.text)}</p><p class="m-0 mt-3"><a href="${href}" class="font-bold text-brand-primary underline">${escapeAlertHtml(options.linkLabel)}</a></p>`,
    showCancelButton: true,
    confirmButtonText: options.linkLabel,
    cancelButtonText: i18n.t("common:cancel"),
  });
  return result.isConfirmed;
}

export function alertLoading(title: string, text?: string) {
  void Swal.fire({
    ...base(),
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
}

export function closeAlert() {
  Swal.close();
}

export function alertSuccess(title: string, text?: string, options?: { timerMs?: number }) {
  const timerMs = options?.timerMs;
  const timed = typeof timerMs === "number" && timerMs > 0;

  return Swal.fire({
    ...base(),
    icon: "success",
    title,
    text,
    confirmButtonText: i18n.t("common:ok"),
    ...(timed
      ? {
          timer: timerMs,
          timerProgressBar: true,
          showConfirmButton: false,
        }
      : {}),
  });
}

export async function promptEmail(options: {
  title: string;
  text?: string;
  value?: string;
  confirmText?: string;
}): Promise<string | null> {
  const result = await Swal.fire({
    ...base(),
    icon: "question",
    title: options.title,
    text: options.text,
    input: "email",
    inputValue: options.value ?? "",
    inputPlaceholder: i18n.t("auth:emailPlaceholder"),
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? i18n.t("common:send"),
    cancelButtonText: i18n.t("common:cancel"),
    inputValidator: (value) => {
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        return i18n.t("common:alerts.invalidEmail");
      }
    },
  });

  if (!result.isConfirmed || typeof result.value !== "string") {
    return null;
  }

  return result.value.trim();
}

export async function alertApiError(err: unknown): Promise<void> {
  if (isUploadCancelled(err)) {
    return;
  }
  if (err instanceof ApiError) {
    const items = err.errors ? Object.values(err.errors).flat() : [];
    if (items.length > 1) {
      await Swal.fire({
        ...base(),
        icon: "error",
        title: i18n.t("common:alerts.checkData"),
        html: `<ul class="list-disc pl-5 text-left text-sm">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`,
      });
      return;
    }
    await alertError(i18n.t("common:alerts.couldNotFinish"), items[0] ?? err.message);
    return;
  }

  await alertError(i18n.t("common:alerts.couldNotFinish"), i18n.t("common:alerts.tryAgain"));
}

export async function alertConfirm(title: string, text: string, confirmText?: string) {
  const result = await Swal.fire({
    ...base(),
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText ?? i18n.t("common:confirm"),
    cancelButtonText: i18n.t("common:cancel"),
  });
  return result.isConfirmed;
}

export async function promptTextarea(options: {
  title: string;
  text?: string;
  placeholder?: string;
  value?: string;
  confirmText?: string;
  requiredMessage?: string;
}): Promise<string | null> {
  const result = await Swal.fire({
    ...base(),
    icon: "question",
    title: options.title,
    text: options.text,
    input: "textarea",
    inputValue: options.value ?? "",
    inputPlaceholder: options.placeholder ?? "",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? i18n.t("common:confirm"),
    cancelButtonText: i18n.t("common:cancel"),
    inputValidator: (value) => {
      if (!value?.trim()) {
        return options.requiredMessage ?? i18n.t("common:alerts.incompleteTitle");
      }
    },
  });

  if (!result.isConfirmed || typeof result.value !== "string") {
    return null;
  }

  return result.value.trim();
}

export type ContentReactionChoice = {
  liked: boolean;
  message: string;
};

export async function promptContentReaction(options: {
  title: string;
  text?: string;
  confirmText: string;
  liked?: boolean;
  message?: string;
}): Promise<ContentReactionChoice | null> {
  const likeLabel = i18n.t("app:contentReaction.like");
  const likedLabel = i18n.t("app:contentReaction.liked");
  const hint = i18n.t("app:contentReaction.hint");
  const messageLabel = i18n.t("app:contentReaction.messageLabel");
  const messagePh = i18n.t("app:contentReaction.messagePh");

  const result = await Swal.fire({
    ...base(),
    icon: "question",
    title: options.title,
    html: `
      ${options.text ? `<p class="m-0 text-sm text-slate-600">${escapeAlertHtml(options.text)}</p>` : ""}
      <div class="mt-4 flex flex-col gap-3 text-left">
        <p class="m-0 text-xs font-semibold text-slate-500">${escapeAlertHtml(hint)}</p>
        <button type="button" id="swal-content-like" class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700"></button>
        <label class="flex flex-col gap-1">
          <span class="text-[11px] font-bold tracking-wider text-slate-500 uppercase">${escapeAlertHtml(messageLabel)}</span>
          <textarea id="swal-content-message" rows="3" maxlength="1000" placeholder="${escapeAlertHtml(messagePh)}" class="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm text-slate-800"></textarea>
        </label>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: options.confirmText,
    cancelButtonText: i18n.t("common:cancel"),
    focusConfirm: false,
    didOpen: () => {
      const like = document.getElementById("swal-content-like");
      const message = document.getElementById("swal-content-message");
      if (message instanceof HTMLTextAreaElement) message.value = options.message ?? "";
      const paint = (liked: boolean) => {
        if (!like) return;
        like.dataset.liked = liked ? "1" : "0";
        like.textContent = liked ? `♥ ${likedLabel}` : `♡ ${likeLabel}`;
        like.className = liked
          ? "inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-extrabold text-rose-700"
          : "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700";
      };
      paint(Boolean(options.liked));
      like?.addEventListener("click", () => {
        paint(like.dataset.liked !== "1");
      });
    },
    preConfirm: () => {
      const like = document.getElementById("swal-content-like");
      const message = document.getElementById("swal-content-message");
      return {
        liked: like?.dataset.liked === "1",
        message: message instanceof HTMLTextAreaElement ? message.value.trim() : "",
      };
    },
  });

  if (!result.isConfirmed || !result.value || typeof result.value !== "object") return null;
  const value = result.value as ContentReactionChoice;
  return {
    liked: Boolean(value.liked),
    message: typeof value.message === "string" ? value.message.trim() : "",
  };
}
