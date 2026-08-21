export const PENDING_AGENCY = "pending_agency";

export function isPendingAgency(status?: string | null) {
  return status === PENDING_AGENCY;
}
