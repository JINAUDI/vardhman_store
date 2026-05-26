import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import type { AbandonedCart, AbandonedCartItem, AbandonedCartStatus } from "@/lib/store/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function readIsoDate(value: unknown, fallback = new Date().toISOString()) {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function readItems(value: unknown): AbandonedCartItem[] {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((item) => {
      const row = item as JsonRecord;
      const quantity = Math.max(1, readNumber(row.quantity, 1));
      return {
        productId: readString(row.productId ?? row.product_id ?? row.id),
        name: readString(row.name ?? row.title ?? row.productName, "Product"),
        price: readNumber(row.price),
        quantity,
        image: readString(row.image ?? row.productImage ?? row.image_url) || undefined,
      };
    })
    .filter((item) => item.productId || item.name);
}

function mapAbandonedCart(row: JsonRecord): AbandonedCart {
  const items = readItems(row.items);
  const itemCount = readNumber(
    row.item_count ?? row.itemCount,
    items.reduce((sum, item) => sum + item.quantity, 0)
  );
  const subtotal = readNumber(
    row.subtotal,
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  return {
    id: readString(row.id),
    sessionId: readString(row.session_id ?? row.sessionId),
    authUserId: readString(row.auth_user_id ?? row.authUserId) || undefined,
    customerId: readString(row.customer_id ?? row.customerId) || undefined,
    customerName: readString(row.customer_name ?? row.customerName) || undefined,
    customerEmail: readString(row.customer_email ?? row.customerEmail) || undefined,
    customerPhone: readString(row.customer_phone ?? row.customerPhone) || undefined,
    items,
    itemCount,
    subtotal,
    discount: readNumber(row.discount),
    total: readNumber(row.total, subtotal),
    currency: readString(row.currency, "INR"),
    status: readString(row.status, "open") as AbandonedCartStatus,
    sourcePage: readString(row.source_page ?? row.sourcePage) || undefined,
    checkoutStartedAt: readString(row.checkout_started_at ?? row.checkoutStartedAt) || undefined,
    lastActivityAt: readIsoDate(row.last_activity_at ?? row.lastActivityAt ?? row.updated_at),
    convertedOrderId: readString(row.converted_order_id ?? row.convertedOrderId) || undefined,
    convertedAt: readString(row.converted_at ?? row.convertedAt) || undefined,
    createdAt: readIsoDate(row.created_at ?? row.createdAt),
    updatedAt: readIsoDate(row.updated_at ?? row.updatedAt ?? row.created_at),
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
    const { data, error } = await supabase
      .from("abandoned_carts")
      .select("*")
      .order("last_activity_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(
      {
        status: "success",
        message: "Abandoned carts fetched successfully",
        data: (data ?? []).map((row) => mapAbandonedCart(row as JsonRecord)),
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch abandoned carts from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
