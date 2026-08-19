"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
import { homePathForUser } from "@/lib/auth";
import { clearToken, fetchMe, getToken } from "@/lib/laravel";

export default function HomePage() {
  const router = useRouter();
  const [view, setView] = useState<"landing" | "admin">("landing");

  useEffect(() => {
    if (!getToken()) {
      return;
    }

    fetchMe()
      .then((user) => {
        if (user.role === "admin") {
          setView("admin");
          return;
        }
        router.replace(homePathForUser(user));
      })
      .catch(() => {
        clearToken();
      });
  }, [router]);

  if (view === "admin") {
    return <DashboardScreen />;
  }

  return <LandingPage />;
}
