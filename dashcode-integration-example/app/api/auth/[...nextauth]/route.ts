import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { error: "Auth.js is disabled. Use Supabase email/password login." },
    { status: 410 }
  );
}

export const POST = GET;
