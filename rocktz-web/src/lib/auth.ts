export type UserRole = "admin" | "creator" | "company";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  creator?: {
    id: number;
    full_name: string;
    artistic_name: string;
    status: string;
    photo_url: string | null;
  } | null;
  company?: {
    id: number;
    name: string;
    status: string;
    logo_url: string | null;
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
    return `/creators/${user.creator.id}`;
  }

  return `/creators/${user.id}`;
}

export const AUTH_COOKIE = "rocktz_token";
