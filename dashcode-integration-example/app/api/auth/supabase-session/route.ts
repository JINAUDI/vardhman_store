import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveAdminUser } from "@/lib/supabase/admin-auth";
import { ADMIN_AUTH_COOKIE_NAME } from "@/lib/supabase/admin-session";

type SessionRequestBody = {
  accessToken?: string;
  expiresIn?: number;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SessionRequestBody;
  const accessToken = String(body.accessToken || "");

  if (!accessToken) {
    return NextResponse.json({ error: "Missing Supabase session." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return NextResponse.json({ error: "Supabase session is invalid." }, { status: 401 });
  }

  const adminUser = await getActiveAdminUser(data.user.id, data.user.email);

  if (!adminUser) {
    return NextResponse.json(
      { error: "You are not authorized to access this dashboard" },
      { status: 403 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: adminUser.role,
    },
  });

  response.cookies.set(ADMIN_AUTH_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(60, Number(body.expiresIn) || 3600),
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(ADMIN_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
