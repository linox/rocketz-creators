import { NextResponse } from "next/server";
import { laravelFetch, ApiError } from "@/lib/laravel";

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const data = await laravelFetch<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Erro ao enviar e-mail." }, { status: 500 });
  }
}
