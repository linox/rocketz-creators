"use client";

import { createContext, useContext } from "react";
import type { AuthUser } from "@/lib/auth";

export const AuthUserContext = createContext<AuthUser | null>(null);

export function useAuth() {
  const user = useContext(AuthUserContext);
  if (!user) {
    throw new Error("useAuth precisa estar dentro do AuthenticatedShell");
  }
  return user;
}
