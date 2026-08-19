import { NextResponse } from "next/server";
import { cookieOptions, laravelFetch, ApiError } from "@/lib/laravel";
import { homePathForUser, type AuthPayload } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const payload = await laravelFetch<AuthPayload>("/auth/register/creator", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = NextResponse.json(
      { user: payload.user, redirectTo: homePathForUser(payload.user) },
      { status: 201 },
    );
    response.cookies.set({ ...cookieOptions(), value: payload.token });
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message, errors: error.errors }, { status: error.status });
    }
    return NextResponse.json({ message: "Erro ao cadastrar criador." }, { status: 500 });
  }
}
