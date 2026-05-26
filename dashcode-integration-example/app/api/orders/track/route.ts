import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JsonRecord = Record<string, unknown>;

function pickTrackingOrder(order: JsonRecord) {
  return {
    id: order.id,
    tracking_id: order.tracking_id,
    order_number: order.order_number,
    tracking_status: order.tracking_status,
    status: order.status,
    order_status: order.order_status,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    refund_status: order.refund_status,
    invoice_number: order.invoice_number,
    courier_name: order.courier_name ?? order.courier,
    courier_tracking_number: order.courier_tracking_number,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    total: order.total,
    created_at: order.created_at,
    estimated_delivery_date: order.estimated_delivery_date,
    estimated_delivery: order.estimated_delivery,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const trackingId = (request.nextUrl.searchParams.get("tracking_id") || request.nextUrl.searchParams.get("q") || "").trim();
  if (trackingId.length < 4) {
    return NextResponse.json(
      { status: "fail", message: "Tracking ID is required.", data: null },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    let { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("tracking_id", trackingId)
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      const fallback = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", trackingId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      order = fallback.data;
    }

    if (!order) {
      return NextResponse.json(
        { status: "success", message: "Order not found", data: null, storage: "supabase" },
        { headers: CORS_HEADERS }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name,quantity,price,total")
      .eq("order_id", order.id);

    if (itemsError) throw itemsError;

    const { data: history, error: historyError } = await supabase
      .from("order_status_history")
      .select("status,status_type,note,created_by,created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    if (historyError) {
      console.warn("[orders] Unable to fetch public tracking history.", historyError);
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Order tracking fetched successfully",
        data: {
          order: pickTrackingOrder(order as JsonRecord),
          items: items ?? [],
          history: historyError ? [] : history ?? [],
        },
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch order tracking from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
