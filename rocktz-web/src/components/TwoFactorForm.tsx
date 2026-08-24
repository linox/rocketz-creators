"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import type { AuthPayload, TwoFactorChallenge } from "@/lib/auth";
import { laravelFetch } from "@/lib/laravel";
import { cn } from "@/lib/cn";

type TwoFactorFormProps = {
  challenge: TwoFactorChallenge;
  onVerified: (payload: AuthPayload) => void | Promise<void>;
  onCancel?: () => void;
  theme?: "dark" | "light";
};

export function TwoFactorForm({ challenge, onVerified, onCancel, theme = "dark" }: TwoFactorFormProps) {
  const { t } = useTranslation();
  const ta = (key: string, opts?: Record<string, unknown>) => t(`auth:${key}`, opts);
  const tc = (key: string) => t(`common:${key}`);
  const [code, setCode] = useState("");
  const [token, setToken] = useState(challenge.challenge_token);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const dark = theme === "dark";

  const fieldClass = dark
    ? "h-11 w-full rounded-xl border border-white/10 bg-[#1E293B]/40 px-4 text-center text-lg tracking-[0.35em] text-white outline-none focus:border-brand-primary"
    : "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-lg tracking-[0.35em] text-slate-900 outline-none focus:border-purple-500";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = code.replace(/\D/g, "");
    if (normalized.length !== 6) {
      await alertWarning(tc("alerts.incompleteTitle"), ta("twoFactorIncomplete"));
      return;
    }
    setLoading(true);
    try {
      const payload = await laravelFetch<AuthPayload>("/auth/two-factor/verify", {
        method: "POST",
        body: JSON.stringify({ challenge_token: token, code: normalized }),
      });
      await onVerified(payload);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const next = await laravelFetch<TwoFactorChallenge>("/auth/two-factor/resend", {
        method: "POST",
        body: JSON.stringify({ challenge_token: token }),
      });
      setToken(next.challenge_token);
      setCode("");
      await alertSuccess(ta("twoFactorResentTitle"), ta("twoFactorResent"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setResending(false);
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={onSubmit}>
      <div>
        <h3 className={cn("text-2xl font-black", dark ? "text-white" : "text-slate-950")}>{ta("twoFactorTitle")}</h3>
        <p className={cn("mt-2 text-sm", dark ? "text-slate-400" : "text-slate-500")}>
          {ta("twoFactorSubtitle", { email: challenge.email_hint })}
        </p>
      </div>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        className={fieldClass}
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <button disabled={loading} className="w-full rounded-xl bg-brand-primary py-3 font-bold text-white disabled:opacity-50">
        {loading ? ta("wait") : ta("twoFactorVerify")}
      </button>
      <div className={cn("flex items-center justify-between text-xs font-semibold", dark ? "text-indigo-300" : "text-purple-700")}>
        <button type="button" disabled={resending} onClick={() => void resend()} className="hover:underline disabled:opacity-50">
          {resending ? ta("sending") : ta("twoFactorResend")}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}>
            {tc("back")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
