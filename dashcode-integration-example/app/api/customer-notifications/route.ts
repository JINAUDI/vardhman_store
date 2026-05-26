import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const authUserId = typeof body.authUserId === "string" ? body.authUserId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const type = typeof body.type === "string" && body.type.trim() ? body.type.trim() : "account";

    if (!authUserId || !title) {
      return NextResponse.json(
        { status: "fail", message: "Customer and title are required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_notifications")
      .insert({
        auth_user_id: authUserId,
        title,
        message,
        type,
        is_read: false,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { status: "success", message: "Customer notification sent.", data },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to send customer notification."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
