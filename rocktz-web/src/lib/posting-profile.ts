export type PostingProfile = "creator" | "brand";

export function isBrandPosting(value?: string | null): boolean {
  return value === "brand";
}

export function normalizePostingProfile(value?: string | null): PostingProfile {
  return isBrandPosting(value) ? "brand" : "creator";
}
