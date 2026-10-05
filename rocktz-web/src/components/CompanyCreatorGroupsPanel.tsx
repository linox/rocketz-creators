"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { matchesNetworkRange, NETWORK_TIER_BOUNDS, networkSize } from "@/lib/network-size";
import { usePrivacy } from "@/lib/privacy";
import type { Creator, CreatorGroup } from "@/lib/types";

const FILTER_TRIGGER =
  "h-[42px] rounded-lg border-[#E2E8F0] bg-white px-4 text-xs font-bold tracking-wide text-[#64748B] uppercase";

export function CompanyCreatorGroupsPanel({
  companyId,
  onCountChange,
}: {
  companyId: number;
  onCountChange?: (count: number) => void;
}) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatNumber } = usePrivacy();
  const [groups, setGroups] = useState<CreatorGroup[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pool, setPool] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const selected = groups.find((group) => group.id === selectedId) ?? null;
  const memberIds = useMemo(() => new Set((selected?.creators ?? []).map((creator) => creator.id)), [selected]);

  const networkOptions = useMemo(() => [
    { value: "all", label: t("creators.allNetworkSizes") },
    { value: "nano", label: t("creators.networkNano") },
    { value: "micro", label: t("creators.networkMicro") },
    { value: "mid", label: t("creators.networkMid") },
    { value: "macro", label: t("creators.networkMacro") },
    { value: "mega", label: t("creators.networkMega") },
  ], [t]);

  async function loadGroups() {
    const res = await api.creatorGroups(`?company_id=${companyId}`);
    const rows = res.data.filter((group) => group.company_id === companyId);
    setGroups(rows);
    onCountChange?.(rows.length);
    setSelectedId((current) => (current && rows.some((group) => group.id === current) ? current : rows[0]?.id ?? null));
    return rows;
  }

  useEffect(() => {
    let cancelled = false;
    api.creatorGroups(`?company_id=${companyId}`)
      .then((res) => {
        if (cancelled) return;
        const rows = res.data.filter((group) => group.company_id === companyId);
        setGroups(rows);
        onCountChange?.(rows.length);
        setSelectedId((current) => (current && rows.some((group) => group.id === current) ? current : rows[0]?.id ?? null));
      })
      .catch((err) => {
        if (!cancelled) void alertApiError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!selected || selected.company_id !== companyId) {
      setPool([]);
      setDraftName("");
      setDraftDescription("");
      return;
    }
    setDraftName(selected.name);
    setDraftDescription(selected.description || "");
    let cancelled = false;
    api.creators(`?company_id=${companyId}`)
      .then((res) => {
        if (!cancelled) setPool(res.data);
      })
      .catch(() => {
        if (!cancelled) setPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.company_id, companyId]);

  const visiblePool = useMemo(() => {
    const term = search.trim().toLowerCase();
    const bounds = networkFilter !== "all" ? NETWORK_TIER_BOUNDS[networkFilter as keyof typeof NETWORK_TIER_BOUNDS] : null;
    return pool.filter((creator) => {
      const size = networkSize(creator.metrics);
      const matchesNetwork = !bounds || matchesNetworkRange(size, bounds.min, bounds.max);
      const matchesSearch = !term || (creator.artistic_name || "").toLowerCase().includes(term) || (creator.full_name || "").toLowerCase().includes(term);
      return matchesNetwork && matchesSearch;
    });
  }, [pool, search, networkFilter]);

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), t("creatorGroups.nameRequired"));
      return;
    }
    try {
      const res = await api.createCreatorGroup({
        name: name.trim(),
        description: description.trim() || null,
        company_id: companyId,
      });
      setCreating(false);
      setName("");
      setDescription("");
      await loadGroups();
      setSelectedId(res.data.id);
      await alertSuccess(t("creatorGroups.created"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (!draftName.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), t("creatorGroups.nameRequired"));
      return;
    }
    try {
      const res = await api.updateCreatorGroup(selected.id, {
        name: draftName.trim(),
        description: draftDescription.trim() || null,
      });
      setGroups((current) => current.map((group) => (group.id === res.data.id ? res.data : group)));
      await alertSuccess(t("creatorGroups.saved"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function removeGroup(group: CreatorGroup) {
    if (!(await alertConfirm(t("creatorGroups.deleteTitle"), t("creatorGroups.deleteText", { name: group.name }), t("creatorGroups.delete")))) return;
    try {
      await api.deleteCreatorGroup(group.id);
      await loadGroups();
      await alertSuccess(t("creatorGroups.deleted"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function toggleMember(creator: Creator) {
    if (!selected) return;
    setBusyId(creator.id);
    try {
      const res = memberIds.has(creator.id)
        ? await api.detachCreatorGroupMember(selected.id, creator.id)
        : await api.attachCreatorGroupMember(selected.id, creator.id);
      setGroups((current) => current.map((group) => (group.id === res.data.id ? res.data : group)));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-xl text-sm text-slate-500">{t("creatorGroups.companyHint")}</p>
        <button type="button" onClick={() => setCreating(true)} className="flex h-11 items-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-600">
          <Plus size={18} /> {t("creatorGroups.new")}
        </button>
      </div>

      {creating ? (
        <form noValidate onSubmit={(event) => void createGroup(event)} className="grid gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creatorGroups.name")}</label>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("creatorGroups.namePh")} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-brand-primary" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creatorGroups.description")}</label>
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("creatorGroups.descriptionPh")} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-brand-primary" />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
            <button type="submit" className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white">{t("creatorGroups.save")}</button>
          </div>
        </form>
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <UsersRound className="mx-auto text-slate-300" size={28} />
          <p className="mt-3 text-sm font-semibold text-slate-500">{t("creatorGroups.empty")}</p>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedId(group.id)}
                className={`rounded-2xl border px-4 py-3 text-left shadow-sm ${selectedId === group.id ? "border-indigo-300 bg-indigo-50" : "border-[#E2E8F0] bg-white hover:border-slate-300"}`}
              >
                <p className="text-sm font-black text-slate-900">{group.name}</p>
                <p className="mt-1 text-[11px] text-slate-500">{t("creatorGroups.membersCount", { count: group.members_count })}</p>
              </button>
            ))}
          </div>

          {selected ? (
            <section className="flex flex-col gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <form noValidate onSubmit={(event) => void saveGroup(event)} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-bold outline-none focus:border-brand-primary" />
                <input value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder={t("creatorGroups.descriptionPh")} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-brand-primary" />
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white">{tc("save")}</button>
                  <button type="button" onClick={() => void removeGroup(selected)} className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    <Trash2 size={13} /> {t("creatorGroups.delete")}
                  </button>
                </div>
              </form>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("creatorGroups.search")} className="w-full rounded-lg border border-[#E2E8F0] py-2.5 pr-3 pl-9 text-sm outline-none focus:border-brand-primary" />
                </div>
                <Select2Field theme="light" searchable={false} value={networkFilter} options={networkOptions} onChange={setNetworkFilter} className="md:w-64" triggerClassName={FILTER_TRIGGER} />
              </div>

              <div className="flex flex-col gap-2">
                {visiblePool.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{t("creatorGroups.poolEmpty")}</p> : null}
                {visiblePool.map((creator) => {
                  const inside = memberIds.has(creator.id);
                  return (
                    <div key={creator.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar src={creator.photo_url} name={creator.artistic_name} size="custom" shape="rounded-xl" className="h-9 w-9 border border-slate-200" textClassName="text-[10px]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900">@{creator.artistic_name}</p>
                          <p className="text-[11px] font-semibold text-slate-500">{formatNumber(networkSize(creator.metrics))}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === creator.id}
                        onClick={() => void toggleMember(creator)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${inside ? "border border-slate-200 bg-white text-slate-600" : "bg-brand-primary text-white"}`}
                      >
                        {inside ? t("creatorGroups.remove") : t("creatorGroups.add")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("creatorGroups.pickGroup")}</p>
          )}
        </div>
      )}
    </div>
  );
}
