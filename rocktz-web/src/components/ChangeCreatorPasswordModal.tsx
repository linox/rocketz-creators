"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, KeyRound, Mail, Sparkles, X } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { PasswordField } from "@/components/PasswordField";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { requestPasswordReset } from "@/lib/laravel";
import { passwordError } from "@/lib/masks";
import type { Creator } from "@/lib/types";

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function ChangeCreatorPasswordModal({
  creator,
  onClose,
}: {
  creator: Creator;
  onClose: () => void;
}) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPassword("");
    setConfirm("");
    setCopied(false);
  }, [creator.id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const issue = passwordError(password, confirm);
    if (issue) {
      await alertWarning(tc("alerts.invalidPasswordTitle"), tc(`password.${issue}`));
      return;
    }
    setSaving(true);
    try {
      await api.updateCreatorPassword(creator.id, password.trim());
      await alertSuccess(t("changePassword.updated"), t("changePassword.updatedBody", { name: creator.artistic_name }));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function copyAccess() {
    const text = t("changePassword.accessTemplate", {
      email: creator.email ?? "",
      password,
      link: `${window.location.origin}/login`,
    });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  }

  async function sendReset() {
    if (!creator.email) {
      await alertWarning(t("changePassword.noEmailTitle"), t("changePassword.noEmailBody"));
      return;
    }
    try {
      const data = await requestPasswordReset(creator.email);
      await alertSuccess(t("changePassword.linkSent"), data.message);
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 font-bold text-brand-primary">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="m-0 text-base font-bold text-slate-900">{t("changePassword.title")}</h3>
              <p className="m-0 text-xs text-slate-500">{t("changePassword.subtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/40 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar src={creator.photo_url} name={creator.artistic_name || creator.full_name} size="md" className="border border-slate-200" />
            <div className="min-w-0">
              <h4 className="m-0 truncate text-sm font-bold text-slate-900">@{creator.artistic_name}</h4>
              <p className="m-0 truncate text-xs text-slate-500">{creator.email || t("changePassword.noEmail")}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-purple-800 uppercase">
            {creator.role === "admin" ? t("creators.admin") : t("changePassword.roleCreator")}
          </span>
        </div>

        <form noValidate onSubmit={onSubmit} className="space-y-4 overflow-y-auto p-6">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">{t("changePassword.newPassword")}</label>
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] font-bold text-brand-primary hover:underline"
                onClick={() => {
                  const generated = generatePassword();
                  setPassword(generated);
                  setConfirm(generated);
                }}
              >
                <Sparkles size={12} />
                {t("changePassword.generate")}
              </button>
            </div>
            <PasswordField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("changePassword.minChars")}
              inputClassName="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">{t("changePassword.confirmPassword")}</label>
            <PasswordField
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("changePassword.repeatPassword")}
              inputClassName="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row">
            <button type="submit" disabled={saving || !password} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1">
              <KeyRound size={14} />
              {saving ? tc("saving") : t("changePassword.save")}
            </button>
            {password ? (
              <button type="button" onClick={copyAccess} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 sm:w-auto">
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copied ? t("changePassword.copied") : t("changePassword.copyAccess")}
              </button>
            ) : null}
          </div>
        </form>

        <div className="border-t border-slate-100 px-6 pt-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h5 className="m-0 text-xs font-bold text-slate-800">{t("changePassword.sendLinkTitle")}</h5>
              <p className="mt-0.5 text-[11px] text-slate-500">{t("changePassword.sendLinkHint")}</p>
            </div>
            <button type="button" onClick={sendReset} disabled={!creator.email} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              <Mail size={13} className="text-brand-primary" />
              {t("changePassword.sendLink")}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
            {tc("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
