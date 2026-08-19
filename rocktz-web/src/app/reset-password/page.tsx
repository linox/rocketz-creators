"use client";

import { FormEvent, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordField } from "@/components/PasswordField";
import { RocketzLogo } from "@/components/RocketzLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { laravelFetch } from "@/lib/laravel";
import { passwordError } from "@/lib/masks";
import { useTranslation } from "react-i18next";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const ta = (key: string) => t(`auth:${key}`);
  const tc = (key: string) => t(`common:${key}`);
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const ready = useMemo(() => Boolean(email && token), [email, token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) {
      await alertWarning(ta("invalidLinkTitle"), ta("invalidLink"));
      return;
    }
    const passwordIssue = passwordError(password, passwordConfirmation);
    if (passwordIssue) {
      await alertWarning(tc("alerts.invalidPasswordTitle"), tc(`password.${passwordIssue}`));
      return;
    }

    setLoading(true);
    try {
      const data = await laravelFetch<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          token,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      await alertSuccess(ta("resetSuccess"), data.message);
      router.push("/login");
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = "border border-white/10 bg-[#1E293B] px-4 text-white outline-none focus:border-brand-primary";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4">
      <form noValidate onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-[#111827] p-8">
        <div className="flex items-center justify-between gap-3">
          <RocketzLogo variant="dark" size="md" href="/" />
          <LanguageSwitcher theme="dark" />
        </div>
        <h1 className="text-xl font-black text-white">{ta("resetTitle")}</h1>
        <PasswordField
          placeholder={ta("newPassword")}
          autoComplete="new-password"
          inputClassName={fieldClass}
          iconClassName="text-slate-400 hover:text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          placeholder={ta("confirmPassword")}
          autoComplete="new-password"
          inputClassName={fieldClass}
          iconClassName="text-slate-400 hover:text-white"
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
        />
        <button disabled={!ready || loading} className="w-full rounded-xl bg-brand-primary py-3 font-bold text-white">
          {loading ? ta("wait") : ta("savePassword")}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
