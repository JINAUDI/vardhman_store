import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseConfigSummary, isSupabaseConfigured } from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: "Supabase environment variables are missing.", data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = typeof body.status === "string" ? body.status : undefined;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote : typeof body.admin_note === "string" ? body.admin_note : undefined;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("return_requests")
      .update({ status, admin_note: adminNote, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    if (data?.auth_user_id && status) {
      await supabase.from("customer_notifications").insert({
        auth_user_id: data.auth_user_id,
        title: `Return request ${status.replace(/_/g, " ")}`,
        message: adminNote || `Your return request is now ${status.replace(/_/g, " ")}.`,
        type: "return",
        is_read: false,
      });
    }

    return NextResponse.json(
      { status: "success", message: "Return request updated", data, storage: "supabase" },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to update return request."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}