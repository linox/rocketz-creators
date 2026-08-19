import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { cookieOptions, fetchMe } from "@/lib/laravel";

export async function requireUser() {
  const token = (await cookies()).get(cookieOptions().name)?.value;
  if (!token) {
    redirect("/login");
  }

  try {
    return await fetchMe(token);
  } catch {
    redirect("/login");
  }
}

export async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Em construção</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
      <p className="mt-3 max-w-xl text-slate-600">
        {description ?? "Esta área será portada do legado nas próximas fases. O banco MySQL já está modelado e populado para testes."}
      </p>
    </div>
  );
}
