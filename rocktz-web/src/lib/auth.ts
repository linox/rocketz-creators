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
  creator?: {
    id: number;
    full_name: string;
    artistic_name: string;
    status: string;
    photo_url: string | null;
    whatsapp?: string | null;
    city?: string | null;
    state?: string | null;
    document?: string | null;
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
  } | null;
};

export type AuthPayload = {
  token: string;
  user: AuthUser;
};

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
