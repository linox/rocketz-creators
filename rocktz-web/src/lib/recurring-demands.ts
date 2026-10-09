import type { ExcludedDemand } from "@/lib/types";

export function excludedDemandCount(
  rows: ExcludedDemand[] | undefined,
  creatorId: number,
  month: string,
  contentTypes?: string[],
) {
  return (rows ?? [])
    .filter((row) => row.creator_id === creatorId && row.month === month && (!contentTypes || contentTypes.includes(row.content_type)))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
}

/** Slots removed this month stay out of the expected total and are not pending. */
export function monthDemandExpectation(quota: number, visible: number, excluded: number) {
  const ungenerated = Math.max(0, quota - visible - excluded);
  return { ungenerated, expected: visible + ungenerated };
}
