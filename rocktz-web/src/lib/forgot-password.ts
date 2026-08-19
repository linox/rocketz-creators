import i18n from "@/i18n/config";
import { alertApiError, alertSuccess, promptEmail } from "@/lib/alerts";
import { requestPasswordReset } from "@/lib/laravel";

export async function promptAndSendPasswordReset(prefill = ""): Promise<boolean> {
  const email = await promptEmail({
    title: i18n.t("auth:forgotTitle"),
    text: i18n.t("auth:forgotText"),
    value: prefill,
    confirmText: i18n.t("auth:sendLink"),
  });

  if (!email) {
    return false;
  }

  try {
    const data = await requestPasswordReset(email);
    await alertSuccess(i18n.t("auth:emailSent"), data.message);
    return true;
  } catch (err) {
    await alertApiError(err);
    return false;
  }
}
