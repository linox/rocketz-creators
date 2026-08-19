import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";
import { AuthenticatedShell, ComingSoon } from "@/components/AuthenticatedShell";
import { cookieOptions, fetchMe } from "@/lib/laravel";
import { homePathForUser } from "@/lib/auth";

export default async function HomePage() {
  const token = (await cookies()).get(cookieOptions().name)?.value;

  if (token) {
    try {
      const user = await fetchMe(token);
      if (user.role === "admin") {
        return (
          <AuthenticatedShell>
            <ComingSoon title="Dashboard" description="KPIs, gráficos e entregas da agência serão portados na próxima fase. Use o menu para navegar pelos placeholders." />
          </AuthenticatedShell>
        );
      }
      redirect(homePathForUser(user));
    } catch {
      // guest landing
    }
  }

  return <LandingPage />;
}
