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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const INDIA_TIME_ZONE_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);
const DELIVERED_STATUSES = new Set(["delivered"]);
const PENDING_STATUSES = new Set(["pending", "confirmed", "processing", "packed"]);
const REVENUE_EXCLUDED_STATUSES = new Set(["cancelled", "canceled", "failed", "refunded", "returned"]);

type OrderSummaryRow = {
  id: string;
  order_number?: string | null;
  tracking_id?: string | null;
  customer_name?: string | null;
  total?: number | string | null;
  status?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
};

type NotificationSummaryRow = {
  id: string;
  title?: string | null;
  message?: string | null;
  order_id?: string | null;
  tracking_id?: string | null;
  customer_name?: string | null;
  total?: number | string | null;
  is_read?: boolean | null;
  created_at?: string | null;
};

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

function normalizeStatus(row: OrderSummaryRow) {
  return readString(row.order_status ?? row.status, "pending").toLowerCase();
}

function isMissingNotificationsTable(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "").toLowerCase()
      : String(error || "").toLowerCase();

  return message.includes("public.notifications") || message.includes("notifications") && message.includes("schema cache");
}

function getIndiaTodayBounds(now = new Date()) {
  const indiaNow = new Date(now.getTime() + INDIA_TIME_ZONE_OFFSET_MS);
  const startUtcMs =
    Date.UTC(indiaNow.getUTCFullYear(), indiaNow.getUTCMonth(), indiaNow.getUTCDate()) -
    INDIA_TIME_ZONE_OFFSET_MS;

  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
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
    const [ordersResult, notificationsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id,order_number,tracking_id,customer_name,total,status,order_status,payment_status,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("id,title,message,order_id,tracking_id,customer_name,total,is_read,created_at")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (notificationsResult.error && !isMissingNotificationsTable(notificationsResult.error)) {
      throw notificationsResult.error;
    }

    const orders = ((ordersResult.data ?? []) as OrderSummaryRow[]).filter((order) => {
      const status = normalizeStatus(order);
      return status !== "refunded" && status !== "returned";
    });
    const notifications = notificationsResult.error
      ? []
      : ((notificationsResult.data ?? []) as NotificationSummaryRow[]);
    const todayBounds = getIndiaTodayBounds();

    let newOrdersToday = 0;
    let pendingOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let todayRevenue = 0;

    for (const order of orders) {
      const status = normalizeStatus(order);
      const total = Math.max(0, readNumber(order.total));
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      const isToday =
        createdAt &&
        !Number.isNaN(createdAt.getTime()) &&
        createdAt >= todayBounds.start &&
        createdAt < todayBounds.end;

      if (isToday) {
        newOrdersToday += 1;
        if (!REVENUE_EXCLUDED_STATUSES.has(status)) {
          todayRevenue += total;
        }
      }

      if (PENDING_STATUSES.has(status)) pendingOrders += 1;
      if (DELIVERED_STATUSES.has(status)) deliveredOrders += 1;
      if (CANCELLED_STATUSES.has(status)) cancelledOrders += 1;
    }

    const unreadNotifications = notifications.filter((notification) => !notification.is_read).length;
    const latestOrders = orders.slice(0, 5).map((order) => ({
      id: order.id,
      orderNumber: readString(order.order_number, `ORD-${order.id.slice(0, 8)}`),
      trackingId: readString(order.tracking_id),
      customerName: readString(order.customer_name, "Customer"),
      total: readNumber(order.total),
      status: normalizeStatus(order),
      paymentStatus: readString(order.payment_status, "pending"),
      createdAt: order.created_at,
    }));
    const latestNotifications = notifications.slice(0, 5).map((notification) => ({
      id: notification.id,
      title: readString(notification.title, "Notification"),
      message: readString(notification.message),
      orderId: readString(notification.order_id),
      trackingId: readString(notification.tracking_id),
      customerName: readString(notification.customer_name, "Customer"),
      total: readNumber(notification.total),
      isRead: Boolean(notification.is_read),
      createdAt: notification.created_at,
    }));

    return NextResponse.json(
      {
        status: "success",
        message: "Live order dashboard fetched successfully",
        data: {
          newOrdersToday,
          pendingOrders,
          deliveredOrders,
          cancelledOrders,
          todayRevenue,
          unreadNotifications,
          latestOrders,
          latestNotifications,
          generatedAt: new Date().toISOString(),
        },
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch live order dashboard from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
