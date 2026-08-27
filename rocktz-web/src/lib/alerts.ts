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

export function alertSuccess(title: string, text?: string) {
  return Swal.fire({
    ...base(),
    icon: "success",
    title,
    text,
    confirmButtonText: i18n.t("common:ok"),
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

export function alertApiError(err: unknown) {
  if (isUploadCancelled(err)) {
    return Promise.resolve();
  }
  if (err instanceof ApiError) {
    const items = err.errors ? Object.values(err.errors).flat() : [];
    if (items.length > 1) {
      return Swal.fire({
        ...base(),
        icon: "error",
        title: i18n.t("common:alerts.checkData"),
        html: `<ul class="list-disc pl-5 text-left text-sm">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`,
      });
    }
    return alertError(i18n.t("common:alerts.couldNotFinish"), items[0] ?? err.message);
  }

  return alertError(i18n.t("common:alerts.couldNotFinish"), i18n.t("common:alerts.tryAgain"));
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
  confirmText?: string;
  requiredMessage?: string;
}): Promise<string | null> {
  const result = await Swal.fire({
    ...base(),
    icon: "question",
    title: options.title,
    text: options.text,
    input: "textarea",
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
