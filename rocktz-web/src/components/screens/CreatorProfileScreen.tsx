"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  FolderPlus,
  Info,
  Instagram,
  Key,
  KeyRound,
  Play,
  Repeat,
  Scale,
  Tv,
  UserCheck,
  Video,
} from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { ChangeCreatorPasswordModal } from "@/components/ChangeCreatorPasswordModal";
import { CreatorContractModal } from "@/components/CreatorContractModal";
import { CreatorSwitcher } from "@/components/CreatorSwitcher";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { CONTRACT_METADATA } from "@/data/creatorContractTerms";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { formatCPF, formatWhatsApp, isValidCPF, UF_OPTIONS } from "@/lib/masks";
import { usePrivacy } from "@/lib/privacy";
import { numericIdFromPath } from "@/lib/route-id";
import type { Campaign, Creator, RecurringContract } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "review", label: "Em Revisão" },
  { value: "paused", label: "Pausado" },
  { value: "rejected", label: "Recusado" },
];

const ROLE_OPTIONS = [
  { value: "creator", label: "Influenciador" },
  { value: "admin", label: "Administrador" },
];

function metricValue(metrics: Record<string, number> | undefined, keys: string[]) {
  if (!metrics) return 0;
  for (const key of keys) {
    const value = Number(metrics[key] ?? 0);
    if (value) return value;
  }
  return 0;
}

function maskPII(value?: string | null, hidden?: boolean) {
  if (!value) return "Não informado";
  if (hidden) return "••••••••";
  return value;
}

function statusChip(status: string) {
  if (status === "active") return { label: "ATIVO", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (status === "review") return { label: "ANÁLISE", className: "bg-amber-100 text-amber-800 border-amber-200" };
  if (status === "paused") return { label: "PAUSADO", className: "bg-slate-100 text-slate-800 border-slate-200" };
  return { label: "RECUSADO", className: "bg-red-100 text-red-800 border-red-200" };
}

function ProfileInner() {
  const user = useAuth();
  const { formatCurrency, formatNumber, hideValues } = usePrivacy();
  const pathname = usePathname();
  const id = numericIdFromPath(pathname, "creators")
    ?? (typeof window !== "undefined" ? numericIdFromPath(window.location.pathname, "creators") : null);

  const [creator, setCreator] = useState<Creator | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"agency" | "creator">("agency");
  const [editing, setEditing] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [adding, setAdding] = useState(false);
  const [recurring, setRecurring] = useState<RecurringContract[]>([]);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [artisticName, setArtisticName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cpf, setCpf] = useState("");
  const [bio, setBio] = useState("");
  const [followers, setFollowers] = useState("");
  const [avgViews, setAvgViews] = useState("");
  const [engagement, setEngagement] = useState("");
  const [priceStory, setPriceStory] = useState("");
  const [priceReel, setPriceReel] = useState("");
  const [pricePost, setPricePost] = useState("");
  const [priceCombo, setPriceCombo] = useState("");
  const [acceptsExchange, setAcceptsExchange] = useState(false);
  const [acceptsPaidTraffic, setAcceptsPaidTraffic] = useState(false);
  const [acceptsExclusivity, setAcceptsExclusivity] = useState(false);

  const isAdmin = user.role === "admin";
  const agencyView = isAdmin && viewMode === "agency";

  function hydrate(data: Creator) {
    setFullName(data.full_name);
    setArtisticName(data.artistic_name);
    setWhatsapp(data.whatsapp ?? "");
    setCity(data.city ?? "");
    setState(data.state ?? "");
    setCpf(data.cpf || data.document || "");
    setBio(data.bio ?? "");
    setFollowers(String(metricValue(data.metrics, ["followers", "instagram_followers"]) || ""));
    setAvgViews(String(metricValue(data.metrics, ["avgViews", "avg_views"]) || ""));
    setEngagement(String(data.metrics?.avgEngagement || data.metrics?.engagement_rate || ""));
    setPriceStory(String(data.pricing?.story ?? ""));
    setPriceReel(String(data.pricing?.reel ?? ""));
    setPricePost(String(data.pricing?.post ?? ""));
    setPriceCombo(String(data.pricing?.combo ?? ""));
    setAcceptsExchange(data.accepts_exchange);
    setAcceptsPaidTraffic(data.accepts_paid_traffic);
    setAcceptsExclusivity(data.accepts_exclusivity);
  }

  async function load() {
    if (!id) {
      setError("Criador não localizado.");
      setLoading(false);
      return;
    }
    try {
      const res = await api.creator(id);
      setCreator(res.data);
      hydrate(res.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Criador não localizado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    api.campaigns().then((res) => setCampaigns(res.data)).catch(() => undefined);
    api.recurring().then((res) => setRecurring(res.data)).catch(() => undefined);
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (user.role === "creator" && user.creator?.id && id !== user.creator.id) {
    return (
      <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito</h2>
        <p className="text-sm leading-relaxed text-slate-600">Como criador, você só tem permissão para acessar e gerenciar o seu próprio perfil profissional.</p>
        <Link href={`/creators/${user.creator.id}`} className="w-full rounded-xl bg-brand-primary py-3 text-center text-xs font-bold tracking-wider text-white uppercase">Ir para Meu Perfil</Link>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="mx-auto mt-12 flex max-w-lg flex-col items-center rounded-xl border border-[#E2E8F0] bg-white p-12 text-center">
        <div className="mb-4 rounded-full bg-red-50 p-3 text-red-500"><Info size={28} /></div>
        <p className="mb-2 font-bold text-[#0F172A]">Erro de Carregamento</p>
        <p className="mb-6 text-sm text-[#64748B]">{error || "Criador não localizado."}</p>
        <Link href="/creators" className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-bold text-white shadow-lg hover:bg-indigo-600">
          <ArrowLeft size={16} /> Voltar para Casting
        </Link>
      </div>
    );
  }

  const chip = statusChip(creator.status);
  const followersN = metricValue(creator.metrics, ["followers", "instagram_followers", "tiktok_followers"]);
  const viewsN = metricValue(creator.metrics, ["avgViews", "avg_views"]);
  const engagementN = creator.metrics?.avgEngagement ?? creator.metrics?.engagement_rate ?? 4.5;
  const myContracts = recurring.filter((contract) => contract.status === "active" && contract.creators?.some((row) => row.creator_id === creator.id));
  const canEdit = isAdmin || user.creator?.id === creator.id;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!fullName.trim() || !artisticName.trim()) {
      await alertWarning("Dados incompletos", "Preencha nome completo e nome artístico.");
      return;
    }
    if (cpf && !isValidCPF(cpf)) {
      await alertWarning("CPF inválido", "Informe um CPF válido.");
      return;
    }
    try {
      await api.updateCreator(creator.id, {
        full_name: fullName.trim(),
        artistic_name: artisticName.replace(/^@/, "").trim(),
        whatsapp: whatsapp || null,
        city: city || null,
        state: state || null,
        cpf: cpf || null,
        document: cpf || null,
        bio,
        metrics: {
          ...creator.metrics,
          followers: Number(followers) || 0,
          avgViews: Number(avgViews) || 0,
          avgEngagement: Number(engagement) || 0,
        },
        pricing: {
          ...creator.pricing,
          story: Number(priceStory) || 0,
          reel: Number(priceReel) || 0,
          post: Number(pricePost) || 0,
          combo: Number(priceCombo) || 0,
        },
        accepts_exchange: acceptsExchange,
        accepts_paid_traffic: acceptsPaidTraffic,
        accepts_exclusivity: acceptsExclusivity,
      });
      await alertSuccess("Perfil atualizado");
      setEditing(false);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function addToCampaign() {
    if (!campaignId) return;
    setAdding(true);
    try {
      await api.assignCreator(Number(campaignId), { creator_id: creator.id });
      await alertSuccess("Criador adicionado à campanha.");
      setCampaignId("");
    } catch (err) {
      await alertApiError(err);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-24">
      {isAdmin ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-900/60 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 text-white shadow-lg sm:p-5 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl border border-indigo-400/30 bg-indigo-500/20 p-2.5 text-indigo-300">
              <Key size={20} className="animate-pulse text-indigo-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="m-0 text-sm font-bold text-white">Painel Admin • Chave de Troca de Usuário</h4>
                <span className="rounded-full border border-indigo-400/30 bg-indigo-500/30 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-indigo-200 uppercase">
                  VISUALIZANDO: @{creator.artistic_name}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">Alterne entre qualquer criador do casting ou troque a visão entre o Painel Interno da Agência e o Portal do Criador.</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2.5 md:w-auto">
            <CreatorSwitcher currentCreatorId={creator.id} handle={creator.artistic_name} variant="banner" />
            <div className="flex rounded-xl border border-slate-700 bg-slate-800/80 p-1">
              <button type="button" onClick={() => setViewMode("agency")} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition-all", viewMode === "agency" ? "bg-purple-600 font-extrabold text-white shadow-md" : "text-slate-300 hover:text-white")}>
                Painel Agência
              </button>
              <button type="button" onClick={() => { setViewMode("creator"); setEditing(false); }} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition-all", viewMode === "creator" ? "bg-purple-600 font-extrabold text-white shadow-md" : "text-slate-300 hover:text-white")}>
                Visão Criador
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {creator.status === "review" ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm"><Clock size={22} /></div>
            <div>
              <h4 className="m-0 text-sm font-bold text-amber-950">{agencyView ? "Criador Aguardando Aprovação de Cadastro" : "Cadastro Sob Análise da Curadoria"}</h4>
              <p className="mt-0.5 max-w-xl text-xs text-amber-800">{agencyView ? "Este influenciador se cadastrou pelo site e necessita da aprovação do administrador para ter seu perfil e candidaturas ativadas." : "Seu perfil foi recebido e está aguardando a aprovação do administrador."}</p>
            </div>
          </div>
          {agencyView ? (
            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              <button type="button" onClick={async () => { try { await api.approveCreator(creator.id); await alertSuccess("Criador aprovado"); load(); } catch (err) { await alertApiError(err); } }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 sm:flex-none">
                <Check size={16} /> Aprovar Criador
              </button>
              <button type="button" onClick={async () => { if (!(await alertConfirm("Recusar criador", "Tem certeza que deseja recusar o cadastro deste criador?", "Recusar"))) return; await api.rejectCreator(creator.id).catch(alertApiError); load(); }} className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-200">Recusar</button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-4">
          {isAdmin ? (
            <Link href="/creators" className="flex items-center gap-2 text-[12px] font-bold tracking-wider text-[#64748B] uppercase transition-colors hover:text-brand-primary">
              <ArrowLeft size={14} /> Voltar para Casting
            </Link>
          ) : null}
          <div className="flex items-center gap-4">
            <UserAvatar src={creator.photo_url} name={creator.artistic_name || creator.full_name} size="custom" shape="rounded-2xl" className="h-16 w-16 border border-[#E2E8F0] shadow-sm" textClassName="text-xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-[26px] font-bold text-[#0F172A]">@{creator.artistic_name}</h1>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider", chip.className)}>{chip.label}</span>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider", creator.role === "admin" ? "border-purple-200 bg-purple-100 text-purple-800" : "border-blue-200 bg-blue-100 text-blue-800")}>
                  {creator.role === "admin" ? "ADMIN" : "INFLUENCIADOR"}
                </span>
              </div>
              <p className="mt-0.5 text-[14px] font-medium text-[#64748B]">
                {creator.full_name}{creator.city ? ` • ${creator.city}${creator.state ? `, ${creator.state}` : ""}` : ""}
              </p>
            </div>
          </div>
        </div>

        {agencyView ? (
          <div className="flex flex-col items-stretch gap-4 md:flex-row">
            <div className="flex min-w-[260px] flex-col justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
              <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">
                <FolderPlus size={11} className="text-brand-primary" /> Selecionar para Campanha
              </span>
              <div className="flex gap-2">
                <Select2Field theme="light" searchable={false} value={campaignId} placeholder="Selecione..." options={campaigns.map((campaign) => ({ value: String(campaign.id), label: campaign.name }))} onChange={setCampaignId} className="min-w-0 flex-1" triggerClassName="h-9 rounded-lg px-2 text-xs font-bold" />
                <button type="button" disabled={!campaignId || adding} onClick={addToCampaign} className="h-9 shrink-0 rounded-lg bg-brand-primary px-3 text-xs font-bold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Adicionar</button>
              </div>
            </div>
            <div className="flex min-w-[320px] flex-col justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
              <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">
                <UserCheck size={11} className="text-purple-600" /> Controle de Acesso & Status (Admin)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold tracking-wide text-[#64748B] uppercase">Função / Permissão</label>
                  <Select2Field theme="light" searchable={false} value={creator.role === "admin" ? "admin" : "creator"} options={ROLE_OPTIONS} onChange={() => undefined} triggerClassName="h-9 rounded-lg px-2 py-1.5 text-xs font-semibold" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold tracking-wide text-[#64748B] uppercase">Status de Casting</label>
                  <Select2Field theme="light" searchable={false} value={creator.status} options={STATUS_OPTIONS} onChange={async (status) => { try { await api.updateCreator(creator.id, { status }); load(); } catch (err) { await alertApiError(err); } }} triggerClassName="h-9 rounded-lg px-2 py-1.5 text-xs font-semibold" />
                </div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPasswordOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-brand-primary hover:bg-purple-100">
                  <KeyRound size={13} /> Alterar Senha
                </button>
                <button type="button" onClick={() => setEditing((value) => !value)} className={cn("flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold", editing ? "bg-slate-900 text-white shadow-xs" : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200")}>
                  <UserCheck size={13} /> {editing ? "Ver Portfolio" : "Editar Perfil"}
                </button>
              </div>
            </div>
          </div>
        ) : canEdit ? (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button type="button" onClick={() => setPasswordOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold tracking-wider text-slate-700 uppercase shadow-xs hover:bg-slate-50">
              <KeyRound size={14} className="text-brand-primary" /> Alterar Minha Senha
            </button>
            <button type="button" onClick={() => setEditing((value) => !value)} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold tracking-wider text-white uppercase shadow-md hover:bg-slate-800">
              <UserCheck size={16} /> {editing ? "Ver Portfolio & Vídeos" : "Completar Perfil Profissional"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        {agencyView ? (
          <div className="flex flex-col gap-6 lg:col-span-1">
            <div className="flex flex-col gap-6 rounded-[16px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h3 className="border-b border-[#F1F5F9] pb-3 text-[14px] font-bold tracking-wider text-[#0F172A] uppercase">Métricas Sociais</h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Instagram size={16} className="text-pink-600" /><span className="text-[13px] text-[#64748B]">Seguidores</span></div>
                  <span className="text-[14px] font-bold text-[#0F172A]">{formatNumber(followersN)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Play size={16} className="text-indigo-600" /><span className="text-[13px] text-[#64748B]">Média de Views</span></div>
                  <span className="text-[14px] font-bold text-[#0F172A]">{formatNumber(viewsN)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Tv size={16} className="text-emerald-600" /><span className="text-[13px] text-[#64748B]">Engajamento</span></div>
                  <span className="text-[14px] font-bold text-brand-primary">{engagementN}%</span>
                </div>
              </div>

              <h3 className="border-b border-[#F1F5F9] pt-3 pb-3 text-[14px] font-bold tracking-wider text-[#0F172A] uppercase">Tabelas de Cache</h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between"><span className="text-[13px] text-[#64748B]">Story</span><span className="text-[14px] font-semibold text-[#0F172A]">{formatCurrency(creator.pricing?.story || 0)}</span></div>
                <div className="flex items-center justify-between"><span className="text-[13px] text-[#64748B]">Reels</span><span className="text-[14px] font-semibold text-[#0F172A]">{formatCurrency(creator.pricing?.reel || 0)}</span></div>
                <div className="flex items-center justify-between"><span className="text-[13px] text-[#64748B]">Feed Post</span><span className="text-[14px] font-semibold text-[#0F172A]">{formatCurrency(creator.pricing?.post || 0)}</span></div>
                <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                  <span className="text-[13px] font-bold text-brand-primary">Combo Comercial</span>
                  <span className="text-[18px] font-bold text-brand-primary">{formatCurrency(creator.pricing?.combo || 0)}</span>
                </div>
              </div>

              <h3 className="border-b border-[#F1F5F9] pt-3 pb-3 text-[14px] font-bold tracking-wider text-[#0F172A] uppercase">Contato & Info</h3>
              <div className="flex flex-col gap-3 text-xs leading-relaxed text-[#475569]">
                <div>
                  <span className="block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">Email</span>
                  <span>{maskPII(creator.email, hideValues)}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">WhatsApp</span>
                  <span>{maskPII(creator.whatsapp, hideValues)}</span>
                </div>
                {(creator.categories ?? []).length > 0 ? (
                  <div>
                    <span className="block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">Nicho / Categorias</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {creator.categories.map((cat) => (
                        <span key={cat} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-[#0F172A] uppercase">{cat}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-1.5 border-t border-[#F1F5F9] pt-2.5">
                  <span className="mb-1.5 block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">Afinidades & Preferências</span>
                  <div className="flex flex-wrap gap-1">
                    {creator.accepts_exchange ? <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Permuta</span> : null}
                    {creator.accepts_paid_traffic ? <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">✓ Tráfego Pago</span> : null}
                    {creator.accepts_exclusivity ? <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">✓ Exclusividade</span> : null}
                    {(creator.work_affinities ?? []).map((aff) => (
                      <span key={aff} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700">✓ {aff}</span>
                    ))}
                    {!creator.accepts_exchange && !creator.accepts_paid_traffic && !creator.accepts_exclusivity && !(creator.work_affinities ?? []).length ? (
                      <span className="text-[11px] text-slate-400 italic">Nenhuma preferência comercial cadastrada</span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 border-t border-[#F1F5F9] pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[9px] font-bold tracking-wide text-[#64748B] uppercase">
                      <Scale size={12} className="text-purple-600" /> Termo Oficial de Adesão & Imagem
                    </span>
                    {creator.contract_acceptance ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700"><CheckCircle2 size={10} /> Assinado</span>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">Pendente</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                    <div className="flex items-start justify-between text-xs">
                      <span className="font-medium text-slate-500">Contrato Digital Rocket:</span>
                      <span className="font-bold text-slate-800">Versão {CONTRACT_METADATA.version}</span>
                    </div>
                    {creator.contract_acceptance ? (
                      <div className="flex flex-col gap-1 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
                        <div className="flex justify-between"><span>Data do Aceite:</span><span className="font-semibold text-slate-700">{creator.contract_acceptance.accepted_at ? new Date(creator.contract_acceptance.accepted_at).toLocaleDateString("pt-BR") : "—"}</span></div>
                        <div className="flex justify-between"><span>Assinado por:</span><span className="font-semibold text-slate-700">{creator.contract_acceptance.full_name}</span></div>
                      </div>
                    ) : null}
                    <button type="button" onClick={() => setContractOpen(true)} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 shadow-xs hover:bg-slate-100">
                      <FileText size={13} /> {creator.contract_acceptance ? "Ver Termo Completo & Auditoria" : "Assinar Termo Oficial"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-8", agencyView ? "lg:col-span-2" : "lg:col-span-3")}>
          {editing ? (
            <form noValidate onSubmit={saveProfile} className="flex flex-col gap-8 rounded-[16px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
              <div>
                <h3 className="flex items-center gap-2 text-[20px] font-bold text-[#0F172A]"><UserCheck size={22} className="text-brand-primary" /> Dados do Perfil Profissional</h3>
                <p className="mt-1 text-[12px] text-[#64748B]">Complete dados, precificação comercial e informações de contato.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nome Completo"><input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
                <Field label="Nome Artístico / @">
                  <div className="relative">
                    <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">@</span>
                    <input className={cn(inputClass, "pl-8 font-semibold")} value={artisticName} onChange={(e) => setArtisticName(e.target.value.replace(/^@+/, ""))} />
                  </div>
                </Field>
                <Field label="WhatsApp de Contato"><input className={inputClass} value={whatsapp} onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))} /></Field>
                <Field label="Cidade"><input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                <Field label="Estado (UF)"><Select2Field theme="light" value={state} options={UF_OPTIONS} onChange={setState} /></Field>
                <Field label="CPF do Criador"><input className={inputClass} value={cpf} maxLength={14} onChange={(e) => setCpf(formatCPF(e.target.value))} /></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Seguidores"><input type="number" className={inputClass} value={followers} onChange={(e) => setFollowers(e.target.value)} /></Field>
                <Field label="Média de Views"><input type="number" className={inputClass} value={avgViews} onChange={(e) => setAvgViews(e.target.value)} /></Field>
                <Field label="Engajamento %"><input type="number" className={inputClass} value={engagement} onChange={(e) => setEngagement(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Field label="Story"><input type="number" className={inputClass} value={priceStory} onChange={(e) => setPriceStory(e.target.value)} /></Field>
                <Field label="Reels"><input type="number" className={inputClass} value={priceReel} onChange={(e) => setPriceReel(e.target.value)} /></Field>
                <Field label="Feed Post"><input type="number" className={inputClass} value={pricePost} onChange={(e) => setPricePost(e.target.value)} /></Field>
                <Field label="Combo"><input type="number" className={inputClass} value={priceCombo} onChange={(e) => setPriceCombo(e.target.value)} /></Field>
              </div>
              <div className="flex flex-wrap gap-3">
                <Toggle checked={acceptsExchange} onChange={setAcceptsExchange} label="Permuta" />
                <Toggle checked={acceptsPaidTraffic} onChange={setAcceptsPaidTraffic} label="Tráfego Pago" />
                <Toggle checked={acceptsExclusivity} onChange={setAcceptsExclusivity} label="Exclusividade" />
              </div>
              <Field label="Bio">
                <textarea className="min-h-28 w-full rounded-lg border border-[#E2E8F0] p-3 text-sm outline-none focus:border-brand-primary" value={bio} onChange={(e) => setBio(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Cancelar</button>
                <button className="rounded-lg bg-brand-primary px-6 py-2 text-sm font-bold text-white">Salvar Perfil</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-col gap-6 rounded-[16px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
                <div>
                  <h3 className="flex items-center gap-2 text-[18px] font-bold text-[#0F172A]">
                    <Video size={20} className="text-brand-primary" /> Portfólio de Vídeos ({creator.portfolio?.length || 0})
                  </h3>
                  <p className="mt-1 text-[12px] text-[#64748B]">Assista aos conteúdos publicados para avaliar a qualidade técnica, oratória e estética dos materiais.</p>
                </div>
                {!(creator.portfolio ?? []).length ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#E2E8F0] p-12 text-center">
                    <div className="rounded-full bg-slate-50 p-3 text-slate-400"><Play size={24} /></div>
                    <h4 className="text-sm font-bold text-slate-800">Portfólio vazio</h4>
                    <p className="max-w-sm text-xs leading-relaxed text-[#64748B]">Nenhum portfólio de vídeo hospedado ainda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {(creator.portfolio ?? []).map((video) => (
                      <article key={video.id} className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[#F1F5F9] bg-slate-50 transition-all hover:border-brand-primary hover:shadow-md">
                        <button type="button" onClick={() => setPlayUrl(video.url)} className="relative flex max-h-[320px] aspect-[9/16] cursor-pointer items-center justify-center overflow-hidden bg-slate-900">
                          <video muted playsInline src={video.url} className="h-full w-full object-cover opacity-70 transition-all group-hover:scale-105" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-all group-hover:bg-black/45">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white shadow-lg backdrop-blur-md">
                              <Play size={24} fill="currentColor" className="translate-x-0.5" />
                            </div>
                          </div>
                          <div className="absolute top-3 left-3 rounded bg-black/55 px-2 py-0.5 font-mono text-[10px] font-medium tracking-tight text-white shadow backdrop-blur-sm">MP4 HOSPEDADO</div>
                        </button>
                        <div className="flex flex-1 flex-col justify-between p-4">
                          <div>
                            <h4 className="truncate pr-4 text-sm font-bold text-[#0F172A] group-hover:text-brand-primary">{video.title}</h4>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#64748B]">{video.description || "Sem descrição cadastrada."}</p>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                            <span className="flex items-center gap-1 font-mono text-[9px] tracking-wider text-slate-400 uppercase">
                              <Clock size={10} /> {video.uploaded_at ? new Date(video.uploaded_at).toLocaleDateString("pt-BR") : "—"}
                            </span>
                            <button type="button" onClick={() => setPlayUrl(video.url)} className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-brand-primary uppercase">
                              <Eye size={12} /> Assistir
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {myContracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-slate-200/80 bg-white p-8 text-center shadow-sm">
                  <div className="rounded-full bg-purple-50 p-3.5 text-purple-600"><Repeat size={24} /></div>
                  <h4 className="m-0 text-base font-bold text-slate-800">Nenhum Contrato Recorrente Ativo</h4>
                  <p className="m-0 max-w-md text-xs leading-relaxed text-slate-500">Este criador ainda não possui contratos recorrentes vinculados a nenhuma empresa. Trabalhos de demandas contínuas por empresa aparecem aqui automaticamente quando configurados no módulo de Contratos Recorrentes.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {myContracts.map((contract) => (
                    <Link key={contract.id} href={`/recurring/${contract.id}`} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm hover:border-purple-300">
                      <p className="text-sm font-bold text-[#0F172A]">{contract.company?.name ?? contract.title}</p>
                      <p className="text-xs text-slate-500">{contract.title}</p>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {passwordOpen ? <ChangeCreatorPasswordModal creator={creator} onClose={() => setPasswordOpen(false)} /> : null}
      {contractOpen ? (
        <CreatorContractModal
          isOpen
          onClose={() => setContractOpen(false)}
          readOnly={Boolean(creator.contract_acceptance) && !canEdit}
          creatorName={creator.full_name}
          creatorEmail={creator.email ?? user.email}
          creatorDocument={creator.document || creator.cpf || ""}
          existingAudit={creator.contract_acceptance ? {
            termId: "rocketz-2026",
            version: CONTRACT_METADATA.version,
            fullName: creator.contract_acceptance.full_name,
            document: creator.document || creator.cpf || "",
            email: creator.email ?? "",
            acceptedAt: creator.contract_acceptance.accepted_at ?? "",
            formattedDate: creator.contract_acceptance.accepted_at ?? "",
            ipUserAgent: "",
            declarations: {},
            allAccepted: true,
            status: "valid",
          } : null}
          onAccept={async (audit) => {
            try {
              await api.acceptContract(creator.id, { full_name: audit.fullName, email: audit.email, document: audit.document });
              await alertSuccess("Termo aceito");
              setContractOpen(false);
              load();
            } catch (err) {
              await alertApiError(err);
            }
          }}
        />
      ) : null}

      {playUrl ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4">
          <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={() => setPlayUrl(null)} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-black shadow-2xl">
            <video src={playUrl} controls autoPlay className="max-h-[80vh] w-full" />
            <button type="button" onClick={() => setPlayUrl(null)} className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold">Fechar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-[#E2E8F0] px-4 text-sm outline-none focus:border-brand-primary";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", checked ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500")}>
      {checked ? "✓ " : ""}{label}
    </button>
  );
}

export function CreatorProfileScreen() {
  return (
    <AuthenticatedShell>
      <ProfileInner />
    </AuthenticatedShell>
  );
}
