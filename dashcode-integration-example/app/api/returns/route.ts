import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseConfigSummary, getSupabaseSetupMessage, isSupabaseConfigured } from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JsonRecord = Record<string, unknown>;

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function mapReturn(row: JsonRecord, order?: JsonRecord) {
  return {
    id: readString(row.id),
    orderId: readString(row.order_id),
    authUserId: readString(row.auth_user_id),
    customerName: readString(row.customer_name || order?.customer_name, "Customer"),
    customerEmail: readString(row.customer_email || order?.customer_email),
    orderNumber: readString(order?.tracking_id || order?.order_number || row.order_id),
    reason: readString(row.reason),
    status: readString(row.status, "requested"),
    adminNote: readString(row.admin_note),
    refundAmount: readNumber(order?.total),
    createdAt: readString(row.created_at),
    updatedAt: readString(row.updated_at),
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: returns, error } = await supabase
      .from("return_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const orderIds = Array.from(new Set((returns || []).map((row) => row.order_id).filter(Boolean)));
    let ordersById = new Map<string, JsonRecord>();

    if (orderIds.length) {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id,order_number,tracking_id,customer_name,customer_email,total,status,order_status")
        .in("id", orderIds);

      if (ordersError) throw ordersError;
      ordersById = new Map((orders || []).map((order) => [String(order.id), order as JsonRecord]));
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Returns fetched successfully",
        data: (returns || []).map((row) => mapReturn(row as JsonRecord, ordersById.get(String(row.order_id)))),
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch return requests."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}