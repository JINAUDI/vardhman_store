import { NextResponse, NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const email = String(reqBody?.email || "").trim().toLowerCase();
    const password = String(reqBody?.password || "");
    const fullName = String(reqBody?.name || reqBody?.full_name || "").trim();

    if (!email || !password) {
      return NextResponse.json(
        { status: "fail", message: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    if (error) {
      return NextResponse.json(
        { status: "fail", message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Account created. Please sign in after your dashboard access is approved.",
      data: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json(
      { status: "fail", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
