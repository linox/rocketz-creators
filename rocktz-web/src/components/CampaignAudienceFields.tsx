"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { formatIntegerMask } from "@/lib/masks";
import type { CreatorGroup } from "@/lib/types";

const TIERS = ["", "nano", "micro", "mid", "macro", "mega", "custom"] as const;

export function CampaignAudienceFields({
  companyId,
  groupIds,
  onGroupIdsChange,
  tier,
  onTierChange,
  minFollowers,
  maxFollowers,
  onMinFollowersChange,
  onMaxFollowersChange,
}: {
  companyId?: number | null;
  groupIds: number[];
  onGroupIdsChange: (ids: number[]) => void;
  tier: string;
  onTierChange: (value: string) => void;
  minFollowers: string;
  maxFollowers: string;
  onMinFollowersChange: (value: string) => void;
  onMaxFollowersChange: (value: string) => void;
}) {
  const { t } = useTranslation("app");
  const [groups, setGroups] = useState<CreatorGroup[]>([]);

  useEffect(() => {
    if (!companyId) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    api.creatorGroups(`?company_id=${companyId}`)
      .then((res) => {
        if (!cancelled) setGroups(res.data.filter((group) => group.company_id === companyId));
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  function toggleGroup(id: number) {
    onGroupIdsChange(groupIds.includes(id) ? groupIds.filter((current) => current !== id) : [...groupIds, id]);
  }

  const tierOptions = TIERS.map((value) => ({
    value,
    label: value ? t(`creators.network${value.charAt(0).toUpperCase()}${value.slice(1)}`) : t("campaigns.networkAny"),
  }));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div>
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <UsersRound size={12} className="text-indigo-600" /> {t("campaigns.audienceTitle")}
        </span>
        <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.audienceHint")}</span>
      </div>
      {companyId && groups.length > 0 ? (
        <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
          {groups.map((group) => (
            <label key={group.id} className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-3 py-2">
              <input
                type="checkbox"
                checked={groupIds.includes(group.id)}
                onChange={() => toggleGroup(group.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>
                <span className="block text-xs font-bold text-slate-800">{group.name}</span>
                <span className="text-[10px] text-slate-500">{t("creatorGroups.membersCount", { count: group.members_count })}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-slate-500">
          {t("campaigns.audienceEmpty")}{" "}
          <Link href="/creator-groups" className="font-bold text-brand-primary hover:underline">{t("creators.groupsLink")}</Link>
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.networkLimitTitle")}</label>
        <span className="text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.networkLimitHint")}</span>
        <Select2Field
          theme="light"
          searchable={false}
          value={tier}
          options={tierOptions}
          onChange={(value) => {
            onTierChange(value);
            if (value !== "custom") {
              onMinFollowersChange("");
              onMaxFollowersChange("");
            }
          }}
        />
      </div>
      {tier === "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.minFollowers")}</label>
            <input
              inputMode="numeric"
              value={minFollowers}
              placeholder={t("creators.minFollowersPh")}
              onChange={(event) => onMinFollowersChange(formatIntegerMask(event.target.value))}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.maxFollowers")}</label>
            <input
              inputMode="numeric"
              value={maxFollowers}
              placeholder={t("creators.maxFollowersPh")}
              onChange={(event) => onMaxFollowersChange(formatIntegerMask(event.target.value))}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
