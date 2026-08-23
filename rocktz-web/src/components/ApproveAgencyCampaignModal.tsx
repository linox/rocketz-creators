"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { AppModal } from "@/components/AppModal";
import { AgencyFeePercentField } from "@/components/AgencyFeePercentField";
import { api } from "@/lib/api";
import { currentAgencyFeePercent, parseAgencyFeePercent } from "@/lib/agency-fee";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { moneyCurrency } from "@/lib/geo";
import { usePrivacy } from "@/lib/privacy";
import type { Campaign } from "@/lib/types";

export function ApproveAgencyCampaignModal({
  campaign,
  onClose,
  onApproved,
}: {
  campaign: Campaign;
  onClose: () => void;
  onApproved: (campaign: Campaign) => void;
}) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency } = usePrivacy();
  const [percent, setPercent] = useState(String(currentAgencyFeePercent(campaign)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPercent(String(currentAgencyFeePercent(campaign)));
  }, [campaign.id, campaign.agency_fee_percent]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAgencyFeePercent(percent);
    if (parsed == null) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaigns.agencyFeeInvalid"));
      return;
    }
    setSaving(true);
    try {
      const res = await api.approveCampaignAgency(campaign.id, { agency_fee_percent: parsed });
      await alertSuccess(t("campaigns.approvedAgency"));
      onApproved(res.data);
      onClose();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal onClose={onClose} panelClassName="max-w-md">
      <form noValidate onSubmit={onSubmit} className="flex flex-col">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <h2 className="m-0 text-lg font-black text-slate-900">{t("campaigns.approveAgencyTitle")}</h2>
          <p className="m-0 mt-1 text-xs font-medium text-slate-500">{t("campaigns.approveAgencyText")}</p>
          <p className="m-0 mt-2 truncate text-sm font-bold text-slate-800">{campaign.name}</p>
        </div>
        <div className="p-5 sm:p-6">
          <AgencyFeePercentField
            id="approve-agency-fee"
            value={percent}
            onChange={setPercent}
            totalBudget={campaign.is_barter ? 0 : campaign.total_budget}
            formatCurrency={(amount) => formatCurrency(amount, moneyCurrency(campaign))}
            disabled={saving || campaign.is_barter}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4 sm:p-5">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
            {tc("cancel")}
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">
            <CheckCircle2 size={14} /> {saving ? tc("saving") : t("campaigns.approveAgency")}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
