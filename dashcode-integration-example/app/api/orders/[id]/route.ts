import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import { mapSupabaseOrderToOrder } from "@/lib/supabase/orders";
import type { OrderStatus, ShippingStatus } from "@/lib/store/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JsonRecord = Record<string, unknown>;

const trackingStatusByOrderStatus: Record<OrderStatus, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  returned: "Returned",
};

const shippingStatusByOrderStatus: Partial<Record<OrderStatus, ShippingStatus>> = {
  pending: "not_shipped",
  confirmed: "not_shipped",
  processing: "not_shipped",
  packed: "not_shipped",
  shipped: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "not_shipped",
  refunded: "returned",
  returned: "returned",
};

const fulfillmentStatusByOrderStatus: Partial<Record<OrderStatus, string>> = {
  pending: "unfulfilled",
  confirmed: "unfulfilled",
  processing: "unfulfilled",
  packed: "partially_fulfilled",
  shipped: "partially_fulfilled",
  out_for_delivery: "partially_fulfilled",
  delivered: "fulfilled",
  cancelled: "returned",
  refunded: "returned",
  returned: "returned",
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function isOrderStatus(value: string): value is OrderStatus {
  return [
    "pending",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
    "returned",
  ].includes(value);
}

function getMissingColumnName(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  return (
    message.match(/Could not find the '([^']+)' column of 'orders'/i)?.[1] ||
    message.match(/column orders\.([^\s]+) does not exist/i)?.[1] ||
    message.match(/column "?([^"\s]+)"? of relation "orders" does not exist/i)?.[1] ||
    null
  );
}

function buildOrderUpdate(body: JsonRecord) {
  const now = new Date().toISOString();
  const update: JsonRecord = {
    updated_at: now,
  };

  const nextStatus = readString(body.status ?? body.orderStatus ?? body.order_status);
  if (nextStatus) {
    if (!isOrderStatus(nextStatus)) {
      throw new Error("Unsupported order status.");
    }
    update.status = nextStatus;
    update.order_status = nextStatus;
    update.tracking_status = readString(body.tracking_status ?? body.trackingStatus, trackingStatusByOrderStatus[nextStatus]);
    update.shipping_status = readString(body.shipping_status ?? body.shippingStatus, shippingStatusByOrderStatus[nextStatus] || "not_shipped");
    update.fulfillment_status = readString(
      body.fulfillment_status ?? body.fulfillmentStatus,
      fulfillmentStatusByOrderStatus[nextStatus] || "unfulfilled"
    );
    update.tracking_updated_at = now;

    if (nextStatus === "shipped") update.shipped_at = now;
    if (nextStatus === "delivered") update.delivered_at = now;
    if (nextStatus === "cancelled") {
      update.cancelled_at = now;
      update.cancellation_reason = readString(body.cancellation_reason ?? body.cancellationReason, "Cancelled by admin");
    }
    if (nextStatus === "refunded") {
      update.refunded_at = now;
      update.refund_status = "refunded";
      update.refund_reason = readString(body.refund_reason ?? body.refundReason, "Refund processed");
    }
  }

  const paymentStatus = readString(body.payment_status ?? body.paymentStatus);
  if (paymentStatus) update.payment_status = paymentStatus;

  const fulfillmentStatus = readString(body.fulfillment_status ?? body.fulfillmentStatus);
  if (fulfillmentStatus) update.fulfillment_status = fulfillmentStatus;

  const shippingStatus = readString(body.shipping_status ?? body.shippingStatus);
  if (shippingStatus) update.shipping_status = shippingStatus;

  const trackingStatus = readString(body.tracking_status ?? body.trackingStatus);
  if (trackingStatus) update.tracking_status = trackingStatus;

  const trackingId = readString(body.tracking_id ?? body.trackingId);
  if (trackingId) {
    update.tracking_id = trackingId;
    update.tracking_updated_at = now;
  }

  const courier = readString(body.courier);
  const courierName = readString(body.courier_name ?? body.courierName, courier);
  if (courierName) {
    update.courier = courierName;
    update.courier_name = courierName;
  }

  const courierTrackingNumber = readString(body.courier_tracking_number ?? body.courierTrackingNumber);
  if (courierTrackingNumber) update.courier_tracking_number = courierTrackingNumber;

  const estimatedDelivery = readString(body.estimated_delivery ?? body.estimatedDelivery);
  const estimatedDeliveryDate = readString(body.estimated_delivery_date ?? body.estimatedDeliveryDate);
  if (estimatedDelivery) update.estimated_delivery = estimatedDelivery;
  if (estimatedDeliveryDate || estimatedDelivery) update.estimated_delivery_date = estimatedDeliveryDate || estimatedDelivery;

  const notes = readString(body.notes);
  if (notes) update.notes = notes;

  const adminNotes = readString(body.admin_notes ?? body.adminNotes);
  if (adminNotes) update.admin_notes = adminNotes;

  const refundStatus = readString(body.refund_status ?? body.refundStatus);
  if (refundStatus) update.refund_status = refundStatus;

  const refundReason = readString(body.refund_reason ?? body.refundReason);
  if (refundReason) update.refund_reason = refundReason;

  const cancellationReason = readString(body.cancellation_reason ?? body.cancellationReason);
  if (cancellationReason) update.cancellation_reason = cancellationReason;

  return update;
}

async function updateOrderWithSchemaFallback(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  update: JsonRecord
) {
  const optionalColumns = new Set([
    "updated_at",
    "order_status",
    "tracking_id",
    "tracking_status",
    "tracking_updated_at",
    "shipping_status",
    "fulfillment_status",
    "payment_status",
    "refund_status",
    "refund_reason",
    "cancellation_reason",
    "shipped_at",
    "delivered_at",
    "cancelled_at",
    "refunded_at",
    "courier",
    "courier_name",
    "courier_tracking_number",
    "estimated_delivery",
    "estimated_delivery_date",
    "notes",
    "admin_notes",
  ]);
  let nextUpdate = { ...update };

  for (;;) {
    const result = await supabase
      .from("orders")
      .update(nextUpdate)
      .eq("id", id)
      .select("*, order_items(*)")
      .single();

    if (!result.error) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || !optionalColumns.has(missingColumn) || !(missingColumn in nextUpdate)) {
      return result;
    }

    delete nextUpdate[missingColumn];
  }
}

async function createStatusNotification(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  order: JsonRecord,
  status: string
) {
  const orderId = readString(order.id);
  if (!orderId || !status) return;

  const orderNumber = readString(order.order_number ?? order.orderNumber, `Order ${orderId.slice(0, 8)}`);
  const trackingId = readString(order.tracking_id ?? order.trackingId);
  const customerName = readString(order.customer_name ?? order.customerName, "Customer");
  const total = Number(order.total) || 0;

  const { error } = await supabase.from("notifications").insert({
    type: "order",
    title: "Order Status Updated",
    message: `${orderNumber} is now ${status}.`,
    order_id: orderId,
    tracking_id: trackingId || null,
    customer_name: customerName,
    customer_phone: readString(order.customer_phone ?? order.customerPhone) || null,
    customer_email: readString(order.customer_email ?? order.customerEmail) || null,
    total,
    is_read: false,
  });

  if (error) {
    console.warn("[admin] Unable to create order status notification.", error);
  }
}

async function createOrderHistory(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderId: string,
  status: string,
  statusType: string,
  note: string,
  createdBy = "admin"
) {
  if (!orderId || !status) return;

  const { error } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    status,
    status_type: statusType,
    note,
    created_by: createdBy,
  });

  if (error) {
    console.warn("[admin] Unable to write order status history.", error);
  }
}

async function createCancellationRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderId: string,
  reason: string,
  cancelledBy: string
) {
  const { error } = await supabase.from("order_cancellations").insert({
    order_id: orderId,
    cancellation_reason: reason,
    cancelled_by: cancelledBy,
  });

  if (error) {
    console.warn("[admin] Unable to write order cancellation record.", error);
  }
}

async function createRefundRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderId: string,
  amount: number,
  reason: string,
  status: string
) {
  const { error } = await supabase.from("order_refunds").insert({
    order_id: orderId,
    refund_amount: amount,
    refund_reason: reason,
    refund_status: status,
    processed_by: "admin",
    processed_at: status === "refunded" ? new Date().toISOString() : null,
  });

  if (error) {
    console.warn("[admin] Unable to write order refund record.", error);
  }
}

async function restoreStockForOrder(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  order: JsonRecord
) {
  const items = Array.isArray(order.order_items) ? (order.order_items as JsonRecord[]) : [];

  await Promise.all(
    items.map(async (item) => {
      const productId = readString(item.product_id);
      const quantity = Number(item.quantity) || 0;
      if (!productId || quantity <= 0) return;

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("stock")
        .eq("id", productId)
        .maybeSingle();

      if (productError || !product) return;

      const stock = Number((product as JsonRecord).stock);
      if (!Number.isFinite(stock)) return;

      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: stock + quantity, updated_at: new Date().toISOString() })
        .eq("id", productId);

      if (updateError) {
        console.warn("[admin] Unable to restore stock after cancellation.", updateError);
      }
    })
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    let { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*), order_status_history(*)")
      .eq("id", id)
      .maybeSingle();

    if (error && String(error.message || "").toLowerCase().includes("order_status_history")) {
      const fallback = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { status: "fail", message: "Order not found", data: null },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Order fetched successfully",
        data: mapSupabaseOrderToOrder(data as JsonRecord),
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch order from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as JsonRecord;
    const updates = buildOrderUpdate(body);

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json(
        { status: "fail", message: "No supported order fields were provided." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: previousOrder } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .maybeSingle();

    const { data, error } = await updateOrderWithSchemaFallback(supabase, id, updates);

    if (error) throw error;

    const updatedOrder = data as JsonRecord;
    if (typeof updates.status === "string") {
      const trackingDetails = [
        readString(updates.tracking_id) ? `Tracking ID: ${readString(updates.tracking_id)}` : "",
        readString(updates.courier_name) ? `Courier: ${readString(updates.courier_name)}` : "",
        readString(updates.courier_tracking_number) ? `Courier tracking: ${readString(updates.courier_tracking_number)}` : "",
      ].filter(Boolean);
      const statusLabel = trackingStatusByOrderStatus[updates.status as OrderStatus] || updates.status;
      const note =
        updates.status === "cancelled"
          ? readString(updates.cancellation_reason, "Order cancelled")
          : updates.status === "refunded"
            ? readString(updates.refund_reason, "Order refunded")
            : trackingDetails.length
              ? `${statusLabel} - ${trackingDetails.join(" | ")}`
              : `Order status changed to ${statusLabel}`;

      await createOrderHistory(supabase, id, updates.status, "order", note);
      await createStatusNotification(supabase, updatedOrder, updates.status);

      if (updates.status === "cancelled") {
        await createCancellationRecord(
          supabase,
          id,
          readString(updates.cancellation_reason, "Order cancelled"),
          readString(body.cancelled_by ?? body.cancelledBy, "admin")
        );

        const previousStatus = readString((previousOrder as JsonRecord | null)?.status ?? (previousOrder as JsonRecord | null)?.order_status);
        if (previousOrder && !["shipped", "out_for_delivery", "delivered", "cancelled", "refunded"].includes(previousStatus)) {
          await restoreStockForOrder(supabase, previousOrder as JsonRecord);
        }
      }

      if (updates.status === "refunded") {
        await createRefundRecord(
          supabase,
          id,
          Number(updatedOrder.total) || 0,
          readString(updates.refund_reason, "Refund processed"),
          "refunded"
        );
      }
    }

    if (typeof updates.payment_status === "string") {
      await createOrderHistory(
        supabase,
        id,
        updates.payment_status,
        "payment",
        `Payment status changed to ${updates.payment_status}`
      );
    }

    if (
      typeof updates.status !== "string" &&
      (
        typeof updates.shipping_status === "string" ||
        typeof updates.tracking_id === "string" ||
        typeof updates.courier_name === "string" ||
        typeof updates.courier_tracking_number === "string" ||
        typeof updates.estimated_delivery_date === "string"
      )
    ) {
      const details = [
        readString(updates.tracking_id) ? `Tracking ID: ${readString(updates.tracking_id)}` : "",
        readString(updates.courier_name) ? `Courier: ${readString(updates.courier_name)}` : "",
        readString(updates.courier_tracking_number) ? `Courier tracking: ${readString(updates.courier_tracking_number)}` : "",
        readString(updates.estimated_delivery_date) ? `ETA: ${readString(updates.estimated_delivery_date)}` : "",
      ].filter(Boolean);
      const deliveryStatus = readString(updatedOrder.order_status ?? updatedOrder.status, readString(updates.shipping_status, "delivery_update"));
      await createOrderHistory(
        supabase,
        id,
        deliveryStatus,
        "delivery",
        details.length ? `Delivery details updated - ${details.join(" | ")}` : "Delivery details updated"
      );
    }

    let responseOrder = updatedOrder;
    const refreshed = await supabase
      .from("orders")
      .select("*, order_items(*), order_status_history(*)")
      .eq("id", id)
      .maybeSingle();

    if (!refreshed.error && refreshed.data) {
      responseOrder = refreshed.data as JsonRecord;
    } else if (refreshed.error && String(refreshed.error.message || "").toLowerCase().includes("order_status_history")) {
      const fallback = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (!fallback.error && fallback.data) {
        responseOrder = fallback.data as JsonRecord;
      }
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Order updated successfully",
        data: mapSupabaseOrderToOrder(responseOrder),
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to update order in Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
