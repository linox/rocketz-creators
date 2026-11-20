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
  dismissed?: boolean;
};

const REACTION_HEART = `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;

export async function promptContentReaction(options: {
  title: string;
  text?: string;
  confirmText: string;
  cancelText?: string;
  liked?: boolean;
  message?: string;
  keepOnDismiss?: boolean;
}): Promise<ContentReactionChoice | null> {
  const likedTitle = i18n.t("app:contentReaction.likedTitle");
  const likedHint = i18n.t("app:contentReaction.likedHint");
  const likeTitle = i18n.t("app:contentReaction.likeTitle");
  const likeHint = i18n.t("app:contentReaction.likeHint");
  const messageLabel = i18n.t("app:contentReaction.messageLabel");
  const messagePh = i18n.t("app:contentReaction.messagePh");
  const optionalLabel = i18n.t("app:contentReaction.optional");
  const theme = base();
  let currentLiked = Boolean(options.liked);
  let currentMessage = options.message ?? "";

  const result = await Swal.fire({
    ...theme,
    icon: "info",
    iconHtml: `<span class="swal-reaction-icon-heart">${REACTION_HEART}</span>`,
    title: options.title,
    html: `
      ${options.text ? `<p class="swal-reaction-lead">${escapeAlertHtml(options.text)}</p>` : ""}
      <button type="button" id="swal-content-like" class="swal-reaction-like" aria-pressed="false">
        <span class="swal-reaction-like-mark" aria-hidden="true">${REACTION_HEART}</span>
        <span class="swal-reaction-like-copy">
          <span id="swal-content-like-title" class="swal-reaction-like-title"></span>
          <span id="swal-content-like-hint" class="swal-reaction-like-hint"></span>
        </span>
        <span class="swal-reaction-like-check" aria-hidden="true"></span>
      </button>
      <label class="swal-reaction-field">
        <span class="swal-reaction-label">
          <span>${escapeAlertHtml(messageLabel)}</span>
          <span class="swal-reaction-optional">${escapeAlertHtml(optionalLabel)}</span>
        </span>
        <textarea id="swal-content-message" rows="3" maxlength="1000" placeholder="${escapeAlertHtml(messagePh)}"></textarea>
      </label>
    `,
    showCancelButton: true,
    confirmButtonText: options.confirmText,
    cancelButtonText: options.cancelText ?? i18n.t("common:cancel"),
    focusConfirm: false,
    customClass: {
      ...theme.customClass,
      popup: "rounded-3xl font-sans swal-reaction-popup",
      icon: "swal-reaction-icon",
      htmlContainer: "swal-reaction-html",
    },
    didOpen: () => {
      const like = document.getElementById("swal-content-like");
      const likeTitleEl = document.getElementById("swal-content-like-title");
      const likeHintEl = document.getElementById("swal-content-like-hint");
      const message = document.getElementById("swal-content-message");
      if (message instanceof HTMLTextAreaElement) {
        message.value = options.message ?? "";
        message.addEventListener("input", () => {
          currentMessage = message.value;
        });
      }
      const paint = (liked: boolean) => {
        currentLiked = liked;
        if (!like) return;
        like.dataset.liked = liked ? "1" : "0";
        like.classList.toggle("is-liked", liked);
        like.setAttribute("aria-pressed", liked ? "true" : "false");
        if (likeTitleEl) likeTitleEl.textContent = liked ? likedTitle : likeTitle;
        if (likeHintEl) likeHintEl.textContent = liked ? likedHint : likeHint;
      };
      paint(Boolean(options.liked));
      if (like) {
        like.onclick = (event) => {
          event.preventDefault();
          paint(like.dataset.liked !== "1");
        };
      }
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

  if (!result.isConfirmed) {
    if (!options.keepOnDismiss) return null;
    return {
      liked: currentLiked,
      message: currentMessage.trim(),
      dismissed: true,
    };
  }
  if (!result.value || typeof result.value !== "object") return null;
  const value = result.value as ContentReactionChoice;
  return {
    liked: Boolean(value.liked),
    message: typeof value.message === "string" ? value.message.trim() : "",
  };
}
