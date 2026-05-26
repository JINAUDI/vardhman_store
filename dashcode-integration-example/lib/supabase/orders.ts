import type {
  FulfillmentStatus,
  Order,
  OrderItem,
  OrderStatus,
  OrderTimelineEvent,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ShippingStatus,
} from "@/lib/store/types";

type JsonRecord = Record<string, unknown>;

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
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

function mapOrderItem(row: JsonRecord): OrderItem {
  const quantity = readNumber(row.quantity, 1);
  const price = readNumber(row.price, 0);

  return {
    productId: readString(row.product_id ?? row.productId),
    productName: readString(row.product_name ?? row.productName, "Product"),
    productImage: readString(row.product_image ?? row.productImage, "/images/all-img/p-1.png"),
    quantity,
    price,
    total: readNumber(row.total, price * quantity),
  };
}

export function mapSupabaseOrderToOrder(row: JsonRecord): Order {
  const id = readString(row.id);
  const createdAt = readIsoDate(row.created_at ?? row.createdAt);
  const items = Array.isArray(row.order_items)
    ? row.order_items.map((item) => mapOrderItem(item as JsonRecord))
    : [];
  const status = readString(row.order_status ?? row.status, "pending") as OrderStatus;
  const customerName = readString(row.customer_name ?? row.customerName, "Customer");
  const customerEmail = readString(row.customer_email ?? row.customerEmail);
  const customerPhone = readString(row.customer_phone ?? row.customerPhone);
  const street = readString(row.delivery_address ?? row.deliveryAddress);
  const city = readString(row.city);
  const state = readString(row.state);
  const zipCode = readString(row.pincode ?? row.zipCode);
  const historyRows = Array.isArray(row.order_status_history)
    ? (row.order_status_history as JsonRecord[])
    : Array.isArray(row.history)
      ? (row.history as JsonRecord[])
      : [];
  const timeline: OrderTimelineEvent[] = historyRows.length
    ? historyRows.map((event, index) => ({
        id: readString(event.id, `${id}_history_${index}`),
        status: readString(event.status, status) as OrderStatus,
        statusType: readString(event.status_type ?? event.statusType, "order"),
        timestamp: readIsoDate(event.created_at ?? event.createdAt),
        note: readString(event.note) || undefined,
        createdBy: readString(event.created_by ?? event.createdBy) || undefined,
      }))
    : [
        {
          id: `${id}_created`,
          status,
          statusType: "order",
          timestamp: createdAt,
          note: "Order placed from Radios storefront",
        },
      ];

  return {
    id,
    orderNumber: readString(row.order_number ?? row.orderNumber, `ORD-${id.slice(0, 8)}`),
    customerId: readString(
      row.customer_id ?? row.customerId ?? row.auth_user_id ?? row.authUserId,
      customerEmail || customerPhone || id
    ),
    customerName,
    customerEmail,
    customerPhone,
    customerAvatar: readString(row.customer_avatar ?? row.customerAvatar, ""),
    items,
    subtotal: readNumber(row.subtotal, items.reduce((sum, item) => sum + item.total, 0)),
    tax: readNumber(row.tax, 0),
    shippingCost: readNumber(row.delivery_charge ?? row.shippingCost, 0),
    discount: readNumber(row.discount, 0),
    total: readNumber(row.total, 0),
    status,
    paymentStatus: readString(row.payment_status ?? row.paymentStatus, "pending") as PaymentStatus,
    paymentMethod: readString(row.payment_method ?? row.paymentMethod, "cod") as PaymentMethod,
    deliveryMethod: readString(row.delivery_method ?? row.deliveryMethod, "standard"),
    shippingStatus: readString(row.shipping_status ?? row.shippingStatus, "not_shipped") as ShippingStatus,
    fulfillmentStatus: readString(row.fulfillment_status ?? row.fulfillmentStatus, "unfulfilled") as FulfillmentStatus,
    refundStatus: readString(row.refund_status ?? row.refundStatus, "none") as RefundStatus,
    trackingId: readString(row.tracking_id ?? row.trackingId),
    courier: readString(row.courier_name ?? row.courierName ?? row.courier),
    courierName: readString(row.courier_name ?? row.courierName ?? row.courier) || undefined,
    courierTrackingNumber: readString(row.courier_tracking_number ?? row.courierTrackingNumber) || undefined,
    estimatedDelivery: readString(row.estimated_delivery_date ?? row.estimated_delivery ?? row.estimatedDelivery) || undefined,
    shippedAt: readString(row.shipped_at ?? row.shippedAt) || undefined,
    deliveredAt: readString(row.delivered_at ?? row.deliveredAt) || undefined,
    cancelledAt: readString(row.cancelled_at ?? row.cancelledAt) || undefined,
    refundedAt: readString(row.refunded_at ?? row.refundedAt) || undefined,
    cancellationReason: readString(row.cancellation_reason ?? row.cancellationReason) || undefined,
    refundReason: readString(row.refund_reason ?? row.refundReason) || undefined,
    adminNotes: readString(row.admin_notes ?? row.adminNotes) || undefined,
    invoiceNumber: readString(row.invoice_number ?? row.invoiceNumber) || undefined,
    invoiceUrl: readString(row.invoice_url ?? row.invoiceUrl) || undefined,
    shippingAddress: {
      id: `${id}_shipping`,
      label: "Shipping",
      street,
      city,
      state,
      zipCode,
      country: readString(row.country, "India"),
      isDefault: true,
    },
    billingAddress: {
      id: `${id}_billing`,
      label: "Billing",
      street,
      city,
      state,
      zipCode,
      country: readString(row.country, "India"),
      isDefault: true,
    },
    timeline,
    notes: readString(row.notes) || undefined,
    couponCode: readString(row.coupon_code ?? row.couponCode) || undefined,
    createdAt,
    updatedAt: readIsoDate(row.updated_at ?? row.updatedAt ?? row.created_at),
  };
}
