"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Layers,
  Menu,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { RocketzLogo } from "@/components/RocketzLogo";

type Modal = "none" | "creator" | "company" | "login";

export function LandingPage() {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>("none");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creatorStep, setCreatorStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creator, setCreator] = useState({
    full_name: "",
    artistic_name: "",
    instagram: "",
    category: "UGC Content",
    whatsapp: "",
    city: "",
    state: "",
    email: "",
    password: "",
    password_confirmation: "",
    lgpd_accepted: false,
  });

  const [company, setCompany] = useState({
    name: "",
    responsible_name: "",
    email: "",
    whatsapp: "",
    segment: "",
    objective: "",
    password: "",
    password_confirmation: "",
    lgpd_accepted: false,
  });

  const [login, setLogin] = useState({ email: "", password: "" });

  useEffect(() => {
    document.body.style.overflow = modal !== "none" ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [modal]);

  function scrollTo(id: string) {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  async function submitJson(url: string, body: unknown) {
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
    router.push(data.redirectTo ?? "/");
    router.refresh();
  }

  async function onCreatorSubmit(event: FormEvent) {
    event.preventDefault();
    if (creator.password !== creator.password_confirmation) {
      setError("As senhas digitadas não coincidem.");
      return;
    }
    if (!creator.lgpd_accepted) {
      setError("Você precisa autorizar o uso de dados de acordo com a LGPD.");
      return;
    }
    await submitJson("/api/auth/register/creator", creator);
  }

  async function onCompanySubmit(event: FormEvent) {
    event.preventDefault();
    if (company.password !== company.password_confirmation) {
      setError("As senhas digitadas não coincidem.");
      return;
    }
    await submitJson("/api/auth/register/company", company);
  }

  async function onLoginSubmit(event: FormEvent) {
    event.preventDefault();
    await submitJson("/api/auth/session", login);
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#FDFDFE] font-sans text-slate-900 antialiased selection:bg-purple-600 selection:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-100/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <RocketzLogo variant="light" size="md" href="/" />
          <nav className="hidden items-center gap-8 text-[14px] font-medium text-slate-600 lg:flex">
            <button onClick={() => scrollTo("para-empresas")} className="hover:text-purple-600">Para empresas</button>
            <button onClick={() => scrollTo("para-criadores")} className="hover:text-purple-600">Para criadores</button>
            <button onClick={() => scrollTo("como-funciona")} className="hover:text-purple-600">Como funciona</button>
            <button onClick={() => scrollTo("recursos")} className="hover:text-purple-600">Recursos</button>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setModal("login")} className="hidden px-4 py-2 text-sm font-semibold text-slate-700 hover:text-purple-600 sm:inline">
              Entrar
            </button>
            <button
              onClick={() => setModal("creator")}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-700"
            >
              Cadastre-se <ArrowRight size={14} />
            </button>
            <button className="rounded-xl p-2 lg:hidden" onClick={() => setMobileOpen((value) => !value)}>
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-purple-50/30 via-white to-white px-4 pb-20 pt-12 sm:px-6 md:pb-28 md:pt-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h1 className="text-4xl font-black leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-[54px]">
              Conectamos marcas a quem <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">cria, influencia e gera resultados.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              Encontre <strong className="text-slate-900">influenciadores, UGC Creators e atores</strong> para campanhas pontuais ou trabalhos recorrentes.
            </p>
            <div className="mt-8 flex max-w-md flex-col gap-3.5 sm:flex-row">
              <div className="flex-1">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Para empresas</p>
                <button onClick={() => setModal("company")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3.5 font-bold text-white hover:bg-purple-700">
                  Sou uma empresa <ArrowRight size={16} />
                </button>
              </div>
              <div className="flex-1">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Para criadores</p>
                <button onClick={() => setModal("creator")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white py-3.5 font-bold text-purple-700 hover:bg-purple-50">
                  Quero ser Creator <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-4 border-t border-slate-100 pt-8 sm:grid-cols-3">
              {[
                { icon: Calendar, title: "Campanhas", sub: "pontuais ou recorrentes" },
                { icon: Users, title: "Diversos perfis", sub: "para cada objetivo e orçamento" },
                { icon: BarChart3, title: "Mais conteúdo", sub: "menos custo e melhores resultados" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-purple-100 bg-purple-50 text-purple-600">
                    <item.icon size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900">{item.title}</h2>
                    <p className="text-[11px] text-slate-500">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative lg:col-span-6">
            <div className="relative aspect-[4/3.8] w-full max-w-[540px] overflow-hidden rounded-3xl border border-slate-100 bg-slate-100 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85"
                alt="Criador de conteúdo"
                className="h-full w-full object-cover"
              />
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="absolute right-4 top-4 w-full max-w-[240px] rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Campanha</p>
                    <h2 className="text-xs font-black text-slate-900">Novo lançamento</h2>
                  </div>
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-bold text-purple-700">Em andamento</span>
                </div>
                {["Briefing", "32 creators encontrados", "8 selecionados", "14 conteúdos entregues"].map((label) => (
                  <div key={label} className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px]">
                    <span className="font-medium">{label}</span>
                    <Check size={14} className="text-emerald-500" />
                  </div>
                ))}
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-4 left-4 max-w-[210px] rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-xl">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Conteúdo aprovado</p>
                <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 size={13} /> Pronto para uso
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="bg-[#FAFAFC] py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Benefícios de usar a plataforma</h2>
          <p className="mt-3 text-lg text-slate-600">Mais eficiência para suas campanhas com creators.</p>
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, title: "Casting inteligente", text: "Encontre criadores por cidade, categoria, cache e formato." },
              { icon: Layers, title: "Campanhas e recorrência", text: "Ações pontuais ou retainer mensal no mesmo fluxo." },
              { icon: Video, title: "Aprovação de conteúdo", text: "Script, vídeo e publicação com histórico de revisão." },
              { icon: Award, title: "Tudo no mesmo lugar", text: "Briefing, entregas, contratos e financeiro da agência." },
            ].map((card) => (
              <div key={card.title} className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-xs">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                  <card.icon size={20} />
                </div>
                <h3 className="font-bold text-slate-950">{card.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-t border-slate-100 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-16 text-center text-3xl font-extrabold text-slate-950 sm:text-4xl">Campanhas pontuais ou trabalhos recorrentes</h2>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50/50 via-white to-slate-50 p-10">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white"><Calendar size={22} /></div>
                <div>
                  <h3 className="text-xl font-bold">Campanhas pontuais</h3>
                  <p className="text-xs font-semibold text-purple-600">Ações de começo, meio e fim</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">Lançamento, promoção, evento ou review com briefing, seleção e entrega.</p>
            </div>
            <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 p-10">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><Layers size={22} /></div>
                <div>
                  <h3 className="text-xl font-bold">Trabalhos recorrentes</h3>
                  <p className="text-xs font-semibold text-indigo-600">Conteúdo mensal contínuo</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">Retainer com planejamento mensal, pautas e aprovação da marca.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-[#FAFAFC] py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div id="para-empresas" className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-10">
            <div>
              <Building2 className="mb-4 text-purple-600" />
              <h3 className="text-2xl font-black">Para empresas</h3>
              <p className="mt-3 text-slate-600">Encontre creators, aprove conteúdo e acompanhe campanhas e recorrência em um só painel.</p>
            </div>
            <button onClick={() => setModal("company")} className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-4 font-bold text-white hover:bg-purple-700">
              Sou uma empresa <ArrowRight size={16} />
            </button>
          </div>
          <div id="para-criadores" className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-10">
            <div>
              <Sparkles className="mb-4 text-purple-600" />
              <h3 className="text-2xl font-black">Para criadores</h3>
              <p className="mt-3 text-slate-600">Candidate-se a campanhas, envie roteiros e vídeos e gerencie trabalhos recorrentes.</p>
            </div>
            <button onClick={() => setModal("creator")} className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white py-4 font-bold text-purple-700 hover:bg-purple-50">
              Quero fazer parte <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-10 text-white lg:flex lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold">Pronto para transformar criadores em resultados?</h2>
              <p className="mt-3 text-slate-400">Conecte sua marca a quem cria conteúdo que vende.</p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setModal("company")} className="rounded-xl bg-purple-600 px-6 py-3.5 font-bold hover:bg-purple-500">Sou uma empresa</button>
              <button onClick={() => setModal("creator")} className="rounded-xl border border-slate-700 px-6 py-3.5 font-bold hover:bg-slate-800">Quero ser Creator</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center sm:px-6 md:flex-row md:items-start md:text-left lg:px-8">
          <RocketzLogo variant="light" size="md" href="/" />
          <p className="text-xs text-slate-500">Criadores certos. Conteúdos melhores. Mais possibilidades para sua marca.</p>
          <a href="mailto:contato@rocketzmkt.com.br" className="md:ml-auto text-sm font-semibold text-purple-700">contato@rocketzmkt.com.br</a>
        </div>
      </footer>

      <AnimatePresence>
        {modal !== "none" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black">
                  {modal === "login" ? "Entrar" : modal === "creator" ? "Quero ser Creator" : "Sou uma empresa"}
                </h3>
                <button onClick={() => { setModal("none"); setError(null); }}><X /></button>
              </div>
              {error ? <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

              {modal === "login" ? (
                <form className="space-y-3" onSubmit={onLoginSubmit}>
                  <input required type="email" placeholder="E-mail" className="h-11 w-full rounded-xl border border-slate-200 px-4" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
                  <input required type="password" placeholder="Senha" className="h-11 w-full rounded-xl border border-slate-200 px-4" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
                  <button disabled={loading} className="w-full rounded-xl bg-purple-600 py-3 font-bold text-white">{loading ? "Entrando..." : "Entrar"}</button>
                  <p className="text-center text-sm text-slate-500">
                    Não tem conta? <button type="button" className="font-bold text-purple-700" onClick={() => setModal("creator")}>Cadastre-se</button>
                  </p>
                </form>
              ) : null}

              {modal === "creator" ? (
                <form className="space-y-3" onSubmit={onCreatorSubmit}>
                  {creatorStep === 1 ? (
                    <>
                      <input required placeholder="Nome completo" className="h-11 w-full rounded-xl border px-4" value={creator.full_name} onChange={(e) => setCreator({ ...creator, full_name: e.target.value })} />
                      <input required placeholder="Nome artístico" className="h-11 w-full rounded-xl border px-4" value={creator.artistic_name} onChange={(e) => setCreator({ ...creator, artistic_name: e.target.value })} />
                      <input required placeholder="Instagram" className="h-11 w-full rounded-xl border px-4" value={creator.instagram} onChange={(e) => setCreator({ ...creator, instagram: e.target.value })} />
                      <select className="h-11 w-full rounded-xl border px-4" value={creator.category} onChange={(e) => setCreator({ ...creator, category: e.target.value })}>
                        <option>UGC Content</option>
                        <option>Influenciador</option>
                        <option>Ator / Apresentador</option>
                      </select>
                      <button type="button" onClick={() => setCreatorStep(2)} className="w-full rounded-xl bg-purple-600 py-3 font-bold text-white">Continuar</button>
                    </>
                  ) : creatorStep === 2 ? (
                    <>
                      <input required placeholder="WhatsApp" className="h-11 w-full rounded-xl border px-4" value={creator.whatsapp} onChange={(e) => setCreator({ ...creator, whatsapp: e.target.value })} />
                      <input required placeholder="Cidade" className="h-11 w-full rounded-xl border px-4" value={creator.city} onChange={(e) => setCreator({ ...creator, city: e.target.value })} />
                      <input required maxLength={2} placeholder="UF" className="h-11 w-full rounded-xl border px-4" value={creator.state} onChange={(e) => setCreator({ ...creator, state: e.target.value.toUpperCase() })} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setCreatorStep(1)} className="flex-1 rounded-xl border py-3 font-bold">Voltar</button>
                        <button type="button" onClick={() => setCreatorStep(3)} className="flex-1 rounded-xl bg-purple-600 py-3 font-bold text-white">Continuar</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <input required type="email" placeholder="E-mail" className="h-11 w-full rounded-xl border px-4" value={creator.email} onChange={(e) => setCreator({ ...creator, email: e.target.value })} />
                      <input required type="password" placeholder="Senha" className="h-11 w-full rounded-xl border px-4" value={creator.password} onChange={(e) => setCreator({ ...creator, password: e.target.value })} />
                      <input required type="password" placeholder="Confirmar senha" className="h-11 w-full rounded-xl border px-4" value={creator.password_confirmation} onChange={(e) => setCreator({ ...creator, password_confirmation: e.target.value })} />
                      <label className="flex items-start gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={creator.lgpd_accepted} onChange={(e) => setCreator({ ...creator, lgpd_accepted: e.target.checked })} />
                        Autorizo o uso dos meus dados de acordo com a LGPD.
                      </label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setCreatorStep(2)} className="flex-1 rounded-xl border py-3 font-bold">Voltar</button>
                        <button disabled={loading} className="flex-1 rounded-xl bg-purple-600 py-3 font-bold text-white">{loading ? "Enviando..." : "Criar conta"}</button>
                      </div>
                    </>
                  )}
                </form>
              ) : null}

              {modal === "company" ? (
                <form className="space-y-3" onSubmit={onCompanySubmit}>
                  <input required placeholder="Nome da empresa" className="h-11 w-full rounded-xl border px-4" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
                  <input required placeholder="Nome do responsável" className="h-11 w-full rounded-xl border px-4" value={company.responsible_name} onChange={(e) => setCompany({ ...company, responsible_name: e.target.value })} />
                  <input required type="email" placeholder="E-mail" className="h-11 w-full rounded-xl border px-4" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
                  <input required placeholder="WhatsApp" className="h-11 w-full rounded-xl border px-4" value={company.whatsapp} onChange={(e) => setCompany({ ...company, whatsapp: e.target.value })} />
                  <input placeholder="Segmento" className="h-11 w-full rounded-xl border px-4" value={company.segment} onChange={(e) => setCompany({ ...company, segment: e.target.value })} />
                  <input required type="password" placeholder="Senha" className="h-11 w-full rounded-xl border px-4" value={company.password} onChange={(e) => setCompany({ ...company, password: e.target.value })} />
                  <input required type="password" placeholder="Confirmar senha" className="h-11 w-full rounded-xl border px-4" value={company.password_confirmation} onChange={(e) => setCompany({ ...company, password_confirmation: e.target.value })} />
                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={company.lgpd_accepted} onChange={(e) => setCompany({ ...company, lgpd_accepted: e.target.checked })} />
                    Autorizo o uso dos dados de acordo com a LGPD.
                  </label>
                  <button disabled={loading} className="w-full rounded-xl bg-purple-600 py-3 font-bold text-white">{loading ? "Enviando..." : "Cadastrar empresa"}</button>
                </form>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
