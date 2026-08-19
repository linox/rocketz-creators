"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RocketzLogo } from "@/components/RocketzLogo";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = useMemo(() => Boolean(email && token), [email, token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        token,
        password,
        password_confirmation: passwordConfirmation,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message);
      return;
    }
    setMessage(data.message);
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-[#111827] p-8">
        <RocketzLogo variant="dark" size="md" href="/" />
        <h1 className="text-xl font-black text-white">Redefinir senha</h1>
        {!ready ? <p className="text-sm text-rose-300">Link inválido.</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        <input required type="password" placeholder="Nova senha" className="h-11 w-full rounded-xl border border-white/10 bg-[#1E293B] px-4 text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input required type="password" placeholder="Confirmar senha" className="h-11 w-full rounded-xl border border-white/10 bg-[#1E293B] px-4 text-white" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} />
        <button disabled={!ready} className="w-full rounded-xl bg-brand-primary py-3 font-bold text-white">Salvar senha</button>
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
