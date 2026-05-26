import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import { mapSupabaseOrderToOrder } from "@/lib/supabase/orders";
import { mapSupabaseRowToProduct } from "@/lib/supabase/products";
import { createInventoryAlertNotification } from "@/lib/supabase/inventory-alerts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JsonRecord = Record<string, unknown>;

type CheckoutLine = {
  productId?: string;
  name?: string;
  price?: number | string;
  image?: string;
  quantity?: number | string;
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

function makeOrderReference(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function makeInvoiceNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getPaymentStatus(paymentMethod: string) {
  return paymentMethod === "cash_on_delivery" || paymentMethod === "cod" ? "cod_pending" : "pending";
}

function isMissingHistoryRelation(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "").toLowerCase()
      : String(error || "").toLowerCase();

  return message.includes("order_status_history") || message.includes("schema cache");
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
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

  try {
    const id = request.nextUrl.searchParams.get("id");
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("orders")
      .select("*, order_items(*), order_status_history(*)")
      .order("created_at", { ascending: false });

    if (id) {
      query = query.eq("id", id);
    }

    let { data, error } = await query;

    if (error && isMissingHistoryRelation(error)) {
      let fallbackQuery = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });

      if (id) {
        fallbackQuery = fallbackQuery.eq("id", id);
      }

      const fallback = await fallbackQuery;
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const orders = (data ?? []).map((row) => mapSupabaseOrderToOrder(row as JsonRecord));

    return NextResponse.json(
      {
        status: "success",
        message: "Orders fetched successfully",
        data: id ? orders[0] ?? null : orders,
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch orders from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  let insertedOrderId: string | null = null;

  try {
    const body = (await request.json()) as JsonRecord;
    const customer = (body.customer ?? {}) as JsonRecord;
    const pricing = (body.pricing ?? {}) as JsonRecord;
    const discount = (body.discount ?? {}) as JsonRecord | null;
    const lines = Array.isArray(body.products)
      ? (body.products as CheckoutLine[]).filter((line) => readString(line.productId))
      : [];

    if (!lines.length) {
      return NextResponse.json(
        { status: "fail", message: "Order must contain at least one product." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = createSupabaseAdminClient();
    const productIds = Array.from(new Set(lines.map((line) => readString(line.productId)).filter(Boolean)));
    const { data: productRows, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);

    if (productsError) throw productsError;

    const productsById = new Map(
      (productRows ?? []).map((row) => {
        const product = mapSupabaseRowToProduct(row as JsonRecord);
        return [product.id, product] as const;
      })
    );

    const customerName =
      [readString(customer.firstName), readString(customer.lastName)].filter(Boolean).join(" ") ||
      readString(customer.name, "Customer");
    const customerEmail = readString(customer.email);
    const customerPhone = readString(customer.phone);
    const deliveryAddress = [readString(customer.addressLine1), readString(customer.addressLine2)]
      .filter(Boolean)
      .join(", ");
    const subtotal = readNumber(pricing.subtotal);
    const discountAmount = readNumber(pricing.discount);
    const deliveryCharge = readNumber(pricing.deliveryCharge ?? pricing.shipping ?? pricing.delivery_charge);
    const total = readNumber(pricing.total, Math.max(0, subtotal + deliveryCharge - discountAmount));
    const orderNumber = makeOrderReference("ORD");
    const trackingId = makeOrderReference("TRK");
    const invoiceNumber = makeInvoiceNumber();
    const couponCode = discount ? readString(discount.code) : "";
    const paymentMethod = readString(body.paymentMethod, "cod");
    const paymentStatus = getPaymentStatus(paymentMethod);

    for (const line of lines) {
      const productId = readString(line.productId);
      const product = productsById.get(productId);
      const requestedQuantity = Math.max(1, readNumber(line.quantity, 1));
      if (product && Number.isFinite(product.stock) && requestedQuantity > product.stock) {
        return NextResponse.json(
          {
            status: "fail",
            message: `${product.name} has only ${product.stock} in stock.`,
          },
          { status: 409, headers: CORS_HEADERS }
        );
      }
    }

    const { data: orderRow, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        tracking_id: trackingId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        delivery_address: deliveryAddress,
        city: readString(customer.city),
        state: readString(customer.state),
        pincode: readString(customer.zipCode ?? customer.pincode),
        country: readString(customer.country, "India"),
        payment_method: paymentMethod,
        delivery_method: readString(body.deliveryMethod, "standard"),
        subtotal,
        discount: discountAmount,
        delivery_charge: deliveryCharge,
        total,
        status: "pending",
        order_status: "pending",
        tracking_status: "Order Placed",
        tracking_updated_at: new Date().toISOString(),
        auth_user_id: readString(customer.authUserId ?? customer.auth_user_id) || null,
        customer_id: readString(customer.customerId ?? customer.customer_id) || null,
        payment_status: paymentStatus,
        shipping_status: "not_shipped",
        fulfillment_status: "unfulfilled",
        refund_status: "none",
        invoice_number: invoiceNumber,
        courier_tracking_number: trackingId,
        coupon_code: couponCode || null,
      })
      .select("*")
      .single();

    if (orderError) throw orderError;
    insertedOrderId = readString((orderRow as JsonRecord).id);

    const orderItemsPayload = lines.map((line) => {
      const productId = readString(line.productId);
      const product = productsById.get(productId);
      const quantity = Math.max(1, readNumber(line.quantity, 1));
      const price = product ? product.price : readNumber(line.price);
      const productImage = product?.images?.[0] || readString(line.image);

      return {
        order_id: insertedOrderId,
        product_id: productId,
        product_name: product?.name || readString(line.name, "Product"),
        product_image: productImage,
        quantity,
        price,
        total: price * quantity,
      };
    });

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload)
      .select("*");

    if (itemsError) throw itemsError;

    const { error: historyError } = await supabase.from("order_status_history").insert({
      order_id: insertedOrderId,
      status: "pending",
      status_type: "order",
      note: "Order placed successfully",
      created_by: "storefront",
    });

    if (historyError && !isMissingHistoryRelation(historyError)) throw historyError;

    await Promise.all(
      orderItemsPayload.map(async (item) => {
        const product = productsById.get(readString(item.product_id));
        if (!product || !Number.isFinite(product.stock)) return;

        const nextStock = Math.max(0, product.stock - readNumber(item.quantity, 1));
        const shouldAutoHide = product.trackInventory !== false && product.allowBackorder !== true && nextStock <= 0;
        const productUpdate = {
          stock: nextStock,
          updated_at: new Date().toISOString(),
          ...(shouldAutoHide
            ? {
                visible: false,
                status: "draft",
              }
            : {}),
        };
        const { error: stockError } = await supabase
          .from("products")
          .update(productUpdate)
          .eq("id", item.product_id);

        if (stockError) {
          console.warn("[orders] Unable to reduce product stock.", stockError);
          return;
        }

        await createInventoryAlertNotification(supabase, product, {
          ...product,
          stock: nextStock,
          availableStock: Math.max(nextStock - (product.reservedStock || 0), 0),
          visible: shouldAutoHide ? false : product.visible,
          isVisible: shouldAutoHide ? false : product.isVisible,
          status: shouldAutoHide ? "draft" : product.status,
        });
      })
    );

    const notificationMessage = `${customerName} placed ${trackingId} for ${formatAmount(total)}.`;
    const { error: notificationError } = await supabase.from("notifications").insert({
      type: "order",
      title: "New Order Received",
      message: notificationMessage,
      order_id: insertedOrderId,
      tracking_id: trackingId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      total,
      is_read: false,
    });

    if (notificationError) throw notificationError;

    const data = mapSupabaseOrderToOrder({
      ...(orderRow as JsonRecord),
      order_items: orderItems ?? [],
    });

    return NextResponse.json(
      {
        status: "success",
        message: "Order created successfully",
        orderId: insertedOrderId,
        orderNumber,
        trackingId,
        invoiceNumber,
        data,
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    if (insertedOrderId) {
      try {
        await createSupabaseAdminClient().from("orders").delete().eq("id", insertedOrderId);
      } catch {
        // Best-effort rollback; the original error is returned below.
      }
    }

    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to create order in Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
