import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieOptions, laravelFetch, ApiError } from "@/lib/laravel";
import { homePathForUser, type AuthPayload } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const payload = await laravelFetch<AuthPayload>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = NextResponse.json({
      user: payload.user,
      redirectTo: homePathForUser(payload.user),
    });
    response.cookies.set({ ...cookieOptions(), value: payload.token });
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message, errors: error.errors }, { status: error.status });
    }
    return NextResponse.json({ message: "Erro ao entrar." }, { status: 500 });
  }
}

export async function GET() {
  const token = (await cookies()).get(cookieOptions().name)?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const data = await laravelFetch<{ user: AuthPayload["user"] }>("/auth/me", { token });
    return NextResponse.json({ user: data.user, redirectTo: homePathForUser(data.user) });
  } catch {
    const response = NextResponse.json({ user: null }, { status: 401 });
    response.cookies.delete(cookieOptions().name);
    return response;
  }
}

export async function DELETE() {
  const token = (await cookies()).get(cookieOptions().name)?.value;
  if (token) {
    await laravelFetch("/auth/logout", { method: "POST", token }).catch(() => undefined);
  }

  const response = NextResponse.json({ message: "Sessão encerrada." });
  response.cookies.delete(cookieOptions().name);
  return response;
}
