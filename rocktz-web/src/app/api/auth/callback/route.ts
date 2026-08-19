import { NextRequest, NextResponse } from "next/server";
import { cookieOptions, fetchMe } from "@/lib/laravel";
import { homePathForUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const fallback = new URL("/login?error=google_failed", request.url);

  if (!token) {
    return NextResponse.redirect(fallback);
  }

  try {
    const user = await fetchMe(token);
    const response = NextResponse.redirect(new URL(homePathForUser(user), request.url));
    response.cookies.set({ ...cookieOptions(), value: token });
    return response;
  } catch {
    return NextResponse.redirect(fallback);
  }
}
