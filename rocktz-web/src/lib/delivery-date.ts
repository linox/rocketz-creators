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

export function isoToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function calendarDateKey(value?: string | null) {
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/** Missing dates are not late. A date is late only on the day after it. */
export function isDateBeforeToday(value?: string | null, today = isoToday()) {
  const key = calendarDateKey(value);
  return Boolean(key && key < today);
}

/**
 * Generated recurring demands store the 1st of the month as a placeholder.
 * That day is the month anchor, not a delivery deadline.
 */
export function effectivePlanningDueDate(item: {
  planned_date?: string | null;
  post_date?: string | null;
  month?: string | null;
}) {
  const post = calendarDateKey(item.post_date);
  if (post) return post;
  const planned = calendarDateKey(item.planned_date);
  if (!planned) return null;
  const month = item.month || planned.slice(0, 7);
  if (planned === `${month}-01`) return null;
  return planned;
}

export function planningItemIsOverdue(
  item: { planned_date?: string | null; post_date?: string | null; month?: string | null },
  month?: string | null,
  today = isoToday(),
) {
  const due = effectivePlanningDueDate(item);
  if (due) return isDateBeforeToday(due, today);
  const period = item.month || month || calendarDateKey(item.planned_date)?.slice(0, 7);
  return Boolean(period && period < today.slice(0, 7));
}
