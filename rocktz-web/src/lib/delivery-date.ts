export function effectiveCampaignDeliveryDate(
  row: { delivery_date?: string | null },
  campaign: { delivery_date?: string | null },
): { date: string | null; personalized: boolean } {
  if (row.delivery_date) {
    return { date: row.delivery_date, personalized: true };
  }
  if (campaign.delivery_date) {
    return { date: campaign.delivery_date, personalized: false };
  }
  return { date: null, personalized: false };
}
