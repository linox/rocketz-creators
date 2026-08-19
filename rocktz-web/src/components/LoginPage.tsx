"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { RocketzLogo } from "@/components/RocketzLogo";

type Mode = "login" | "signup";
type UserType = "creator" | "company";

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [userType, setUserType] = useState<UserType>("creator");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    artistic_name: "",
    instagram: "",
    name: "",
    cnpj: "",
    email: "",
    whatsapp: "",
    city: "",
    state: "",
    password: "",
    password_confirmation: "",
    lgpd_accepted: false,
  });

  function update(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(url: string, body: unknown) {
    setLoading(true);
    setError(null);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.message ?? "Não foi possível concluir.");
      return;
    }
    if (data.redirectTo) {
      router.push(data.redirectTo);
      router.refresh();
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "login") {
      await submit("/api/auth/session", { email: form.email, password: form.password });
      return;
    }

    if (form.password !== form.password_confirmation) {
      setError("As senhas digitadas não coincidem.");
      return;
    }

    if (userType === "creator") {
      await submit("/api/auth/register/creator", {
        full_name: form.full_name,
        artistic_name: form.artistic_name,
        instagram: form.instagram,
        email: form.email,
        whatsapp: form.whatsapp,
        city: form.city,
        state: form.state,
        password: form.password,
        password_confirmation: form.password_confirmation,
        lgpd_accepted: form.lgpd_accepted,
      });
      return;
    }

    await submit("/api/auth/register/company", {
      name: form.name,
      responsible_name: form.full_name,
      cnpj: form.cnpj,
      email: form.email,
      whatsapp: form.whatsapp,
      city: form.city,
      state: form.state,
      password: form.password,
      password_confirmation: form.password_confirmation,
      lgpd_accepted: form.lgpd_accepted,
    });
  }

  async function forgotPassword() {
    if (!form.email.includes("@")) {
      setError("Informe um e-mail válido para redefinir a senha.");
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    });
    const data = await response.json();
    setLoading(false);
    setSuccess(data.message);
  }

  const fieldClass =
    "h-11 w-full rounded-xl border border-white/10 bg-[#1E293B]/40 px-4 text-sm text-white outline-none focus:border-brand-primary";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#111827] p-8 shadow-2xl">
        <div className="mb-8 flex justify-center">
          <RocketzLogo variant="dark" size="lg" href="/" />
        </div>
        <div className="mb-6 flex rounded-xl bg-[#1E293B]/40 p-1">
          <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase ${mode === "login" ? "bg-brand-primary text-white" : "text-slate-400"}`}>
            Fazer Login
          </button>
          <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase ${mode === "signup" ? "bg-brand-primary text-white" : "text-slate-400"}`}>
            Criar Conta
          </button>
        </div>
        {error ? <p className="mb-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}
        {success ? <p className="mb-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{success}</p> : null}
        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <>
              <div className="flex rounded-xl border border-white/5 bg-[#1E293B]/40 p-1">
                <button type="button" onClick={() => setUserType("creator")} className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase ${userType === "creator" ? "bg-indigo-600/50 text-white" : "text-slate-400"}`}>Sou Criador</button>
                <button type="button" onClick={() => setUserType("company")} className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase ${userType === "company" ? "bg-indigo-600/50 text-white" : "text-slate-400"}`}>Sou Empresa</button>
              </div>
              <input required className={fieldClass} placeholder={userType === "creator" ? "Nome completo" : "Nome do responsável"} value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
              {userType === "creator" ? (
                <>
                  <input required className={fieldClass} placeholder="Nome artístico" value={form.artistic_name} onChange={(e) => update("artistic_name", e.target.value)} />
                  <input required className={fieldClass} placeholder="Instagram" value={form.instagram} onChange={(e) => update("instagram", e.target.value)} />
                </>
              ) : (
                <>
                  <input required className={fieldClass} placeholder="Nome da empresa" value={form.name} onChange={(e) => update("name", e.target.value)} />
                  <input className={fieldClass} placeholder="CNPJ (opcional)" value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} />
                </>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input required className={fieldClass} placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
                <input required className={fieldClass} placeholder="Cidade" value={form.city} onChange={(e) => update("city", e.target.value)} />
                <input required maxLength={2} className={fieldClass} placeholder="UF" value={form.state} onChange={(e) => update("state", e.target.value.toUpperCase())} />
              </div>
            </>
          ) : null}
          <input required type="email" className={fieldClass} placeholder="E-mail" value={form.email} onChange={(e) => update("email", e.target.value)} />
          <div className="relative">
            <input required type={showPassword ? "text" : "password"} className={`${fieldClass} pr-12`} placeholder="Senha" value={form.password} onChange={(e) => update("password", e.target.value)} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mode === "signup" ? (
            <>
              <input required type="password" className={fieldClass} placeholder="Confirmar senha" value={form.password_confirmation} onChange={(e) => update("password_confirmation", e.target.value)} />
              <label className="flex items-start gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={form.lgpd_accepted} onChange={(e) => update("lgpd_accepted", e.target.checked)} />
                Autorizo o uso dos meus dados de acordo com a LGPD.
              </label>
            </>
          ) : (
            <button type="button" onClick={forgotPassword} className="text-xs font-semibold text-indigo-300">Esqueci minha senha</button>
          )}
          <button disabled={loading} className="w-full rounded-xl bg-brand-primary py-3 font-bold text-white">
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="text-indigo-300">Voltar para a landing</Link>
        </p>
      </div>
    </div>
  );
}
