"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PasswordField } from "@/components/PasswordField";
import { PageHeader } from "@/components/ui/PageHeader";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import type { AuthUser, TwoFactorChallenge } from "@/lib/auth";
import { laravelFetch } from "@/lib/laravel";
import { useAuth } from "@/lib/use-auth";

function SecurityForm() {
  const { t } = useTranslation("app");
  const { t: ta } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const user = useAuth();
  const [enabled, setEnabled] = useState(Boolean(user.two_factor_enabled));
  const [hasPassword] = useState(user.has_password !== false);
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [mode, setMode] = useState<"idle" | "enable" | "disable">("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function resendCode() {
    if (!challenge) return;
    setResending(true);
    try {
      const next = await laravelFetch<TwoFactorChallenge>("/auth/two-factor/resend", {
        method: "POST",
        body: JSON.stringify({ challenge_token: challenge.challenge_token }),
      });
      setChallenge(next);
      setCode("");
      await alertSuccess(ta("twoFactorResentTitle"), ta("twoFactorResent"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setResending(false);
    }
  }

  async function startEnable() {
    setLoading(true);
    try {
      const payload = await laravelFetch<TwoFactorChallenge>("/auth/two-factor/enable", { method: "POST" });
      setChallenge(payload);
      setMode("enable");
      setCode("");
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnable(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    const normalized = code.replace(/\D/g, "");
    if (normalized.length !== 6) {
      await alertWarning(tc("alerts.incompleteTitle"), ta("twoFactorIncomplete"));
      return;
    }
    setLoading(true);
    try {
      const res = await laravelFetch<{ user: AuthUser }>("/auth/two-factor/confirm", {
        method: "POST",
        body: JSON.stringify({ challenge_token: challenge.challenge_token, code: normalized }),
      });
      setEnabled(Boolean(res.user.two_factor_enabled));
      setChallenge(null);
      setMode("idle");
      setCode("");
      window.dispatchEvent(new Event("rocketz:auth-refresh"));
      await alertSuccess(t("security.title"), t("security.enabledSuccess"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  async function startDisable() {
    const ok = await alertConfirm(t("security.disableTitle"), t("security.disableConfirm"));
    if (!ok) return;
    if (hasPassword) {
      setMode("disable");
      setPassword("");
      setCode("");
      return;
    }
    setLoading(true);
    try {
      const payload = await laravelFetch<TwoFactorChallenge>("/auth/two-factor/disable-challenge", { method: "POST" });
      setChallenge(payload);
      setMode("disable");
      setCode("");
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDisable(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const body = hasPassword
        ? { password }
        : { challenge_token: challenge?.challenge_token, code: code.replace(/\D/g, "") };
      if (!hasPassword && (!body.code || body.code.length !== 6)) {
        await alertWarning(tc("alerts.incompleteTitle"), ta("twoFactorIncomplete"));
        setLoading(false);
        return;
      }
      if (hasPassword && !password) {
        await alertWarning(tc("alerts.incompleteTitle"), t("security.passwordRequired"));
        setLoading(false);
        return;
      }
      const res = await laravelFetch<{ user: AuthUser }>("/auth/two-factor/disable", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setEnabled(Boolean(res.user.two_factor_enabled));
      setChallenge(null);
      setMode("idle");
      setPassword("");
      setCode("");
      window.dispatchEvent(new Event("rocketz:auth-refresh"));
      await alertSuccess(t("security.title"), t("security.disabledSuccess"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title={t("security.title")} subtitle={t("security.subtitle")} />
      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{enabled ? t("security.on") : t("security.off")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("security.hint")}</p>
          </div>
        </div>

        {mode === "idle" ? (
          enabled ? (
            <button type="button" disabled={loading} onClick={() => void startDisable()} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50">
              {t("security.disable")}
            </button>
          ) : (
            <button type="button" disabled={loading} onClick={() => void startEnable()} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {t("security.enable")}
            </button>
          )
        ) : null}

        {mode === "enable" && challenge ? (
          <form noValidate className="space-y-3" onSubmit={(e) => void confirmEnable(e)}>
            <p className="text-sm text-slate-600">{ta("twoFactorSubtitle", { email: challenge.email_hint })}</p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-center text-lg tracking-[0.35em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={loading} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {ta("twoFactorVerify")}
              </button>
              <button type="button" disabled={resending} onClick={() => void resendCode()} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-indigo-600 disabled:opacity-50">
                {resending ? ta("sending") : ta("twoFactorResend")}
              </button>
              <button type="button" onClick={() => { setMode("idle"); setChallenge(null); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">
                {tc("cancel")}
              </button>
            </div>
          </form>
        ) : null}

        {mode === "disable" ? (
          <form noValidate className="space-y-3" onSubmit={(e) => void confirmDisable(e)}>
            {hasPassword ? (
              <PasswordField
                placeholder={ta("password")}
                autoComplete="current-password"
                inputClassName="h-11 w-full rounded-xl border border-slate-200 px-4"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ) : (
              <>
                <p className="text-sm text-slate-600">{ta("twoFactorSubtitle", { email: challenge?.email_hint ?? user.email })}</p>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-center text-lg tracking-[0.35em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button type="button" disabled={resending} onClick={() => void resendCode()} className="text-left text-xs font-semibold text-indigo-600 disabled:opacity-50">
                  {resending ? ta("sending") : ta("twoFactorResend")}
                </button>
              </>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {t("security.disable")}
              </button>
              <button type="button" onClick={() => { setMode("idle"); setChallenge(null); setPassword(""); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">
                {tc("cancel")}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </>
  );
}

export function SecuritySettingsScreen() {
  return (
    <AuthenticatedShell>
      <SecurityForm />
    </AuthenticatedShell>
  );
}
