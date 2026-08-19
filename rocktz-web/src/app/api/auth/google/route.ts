import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const intent = new URL(request.url).searchParams.get("intent") ?? "login";
  const api = process.env.LARAVEL_API_URL ?? "http://localhost:8000/api";
  return NextResponse.redirect(`${api}/auth/google/redirect?intent=${encodeURIComponent(intent)}`);
}
