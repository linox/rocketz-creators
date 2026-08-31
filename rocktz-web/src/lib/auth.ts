export type UserRole = "admin" | "creator" | "company";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  locale?: string;
  role: UserRole;
  avatar_url?: string | null;
  permissions?: string[];
  can_publish_without_approval?: boolean;
  two_factor_enabled?: boolean;
  has_password?: boolean;
  creator?: {
    id: number;
    full_name: string;
    artistic_name: string;
    status: string;
    photo_url: string | null;
    whatsapp?: string | null;
    city?: string | null;
    country?: string | null;
    state?: string | null;
    document?: string | null;
    can_access_all_countries?: boolean;
    categories?: string[];
    socials?: Record<string, string>;
    contract_acceptance?: {
      id: number;
      status: string;
      accepted_at: string | null;
      full_name: string;
    } | null;
  } | null;
  company?: {
    id: number;
    name: string;
    status: string;
    logo_url: string | null;
    whatsapp?: string | null;
    city?: string | null;
    country?: string | null;
    currency?: string | null;
    creator_invite_code?: string | null;
  } | null;
  companies?: {
    id: number;
    name: string;
    status: string;
    logo_url: string | null;
    company_user_id?: number;
    whatsapp?: string | null;
    city?: string | null;
    country?: string | null;
    currency?: string | null;
    creator_invite_code?: string | null;
  }[];
};

export type AuthPayload = {
  token: string;
  user: AuthUser;
};

export type TwoFactorChallenge = {
  two_factor_required: true;
  challenge_token: string;
  email_hint: string;
  expires_in?: number;
  message?: string;
};

export function isTwoFactorChallenge(payload: unknown): payload is TwoFactorChallenge {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as Partial<TwoFactorChallenge>;
  return data.two_factor_required === true && typeof data.challenge_token === "string";
}

export function homePathForUser(user: AuthUser): string {
  if (user.role === "admin") {
    return "/dashboard";
  }

  if (user.role === "company") {
    return "/company-dashboard";
  }

  if (user.creator?.id) {
    return `/creators/${user.creator.id}?tab=dashboard`;
  }

  return "/creator-dashboard";
}

export const AUTH_COOKIE = "rocktz_token";

export function userHasPermission(user: AuthUser | null | undefined, slug: string) {
  if (!user) return false;
  if (user.role !== "admin" && user.role !== "company") return false;
  if (user.role === "admin" && (!user.permissions || user.permissions.length === 0)) return true;
  return (user.permissions ?? []).includes(slug);
}

export function userCanModerateCreator(
  user: { role?: string | null; company?: { id?: number | null } | null; permissions?: string[] } | null | undefined,
  creator: { status?: string | null; invited_by_company_id?: number | null; can_moderate?: boolean; landing_review?: { id?: number } | null },
) {
  if (creator.status !== "review") return false;
  if (typeof creator.can_moderate === "boolean") return creator.can_moderate;
  if (user?.role === "admin") return userHasPermission(user as AuthUser, "creators.moderate");
  if (user?.role !== "company") return false;
  const companyId = Number(user.company?.id);
  if (!companyId) return false;
  if (Number(creator.invited_by_company_id) === companyId) return true;
  return Boolean(creator.landing_review?.id);
}
