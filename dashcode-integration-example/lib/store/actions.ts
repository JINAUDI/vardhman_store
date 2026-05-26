// ============================================================
// E-Commerce Store Actions â€” Helper functions for state mutations
// ============================================================
import type { SetStateAction } from "jotai";
import type {
  Order,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
  Product,
  Customer,
  Coupon,
  ReturnRequest,
  ReturnStatus,
  AppNotification,
  ActivityLog,
  Banner,
  ProductDraft,
  DiscountCategory,
} from "./types";
import { generateId } from "./ecommerce-store";

// ============================================================
// ORDER ACTIONS
// ============================================================

// Valid status transitions (state machine)
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["refunded", "returned"],
  cancelled: [],
  refunded: [],
  returned: [],
};

export function canTransitionTo(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

export function updateOrderStatus(
  orders: Order[],
  orderId: string,
  newStatus: OrderStatus,
  note?: string
): Order[] {
  return orders.map((order) => {
    if (order.id !== orderId) return order;
    if (!canTransitionTo(order.status, newStatus)) return order;

    const now = new Date().toISOString();
    const updatedTimeline = [
      ...order.timeline,
      {
        id: generateId("evt"),
        status: newStatus,
        timestamp: now,
        note: note || `Status changed to ${newStatus}`,
      },
    ];

    // Determine payment and shipping status based on order status
    let paymentStatus = order.paymentStatus;
    let shippingStatus = order.shippingStatus;

    if (newStatus === "delivered") {
      paymentStatus = "paid";
      shippingStatus = "delivered";
    } else if (newStatus === "shipped" || newStatus === "out_for_delivery") {
      shippingStatus = "in_transit";
    } else if (newStatus === "cancelled") {
      if (paymentStatus === "paid") paymentStatus = "refunded";
      shippingStatus = "returned";
    } else if (newStatus === "refunded") {
      paymentStatus = "refunded";
    }

    return {
      ...order,
      status: newStatus,
      paymentStatus,
      shippingStatus,
      fulfillmentStatus:
        newStatus === "delivered"
          ? "fulfilled"
          : newStatus === "cancelled" || newStatus === "refunded" || newStatus === "returned"
            ? "returned"
            : order.fulfillmentStatus || "unfulfilled",
      refundStatus: newStatus === "refunded" ? "refunded" : order.refundStatus,
      timeline: updatedTimeline,
      updatedAt: now,
    };
  });
}

export function updateOrderShipping(
  orders: Order[],
  orderId: string,
  trackingId: string,
  courier: string,
  estimatedDelivery?: string
): Order[] {
  return orders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      trackingId,
      courier,
      estimatedDelivery,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function processRefund(
  orders: Order[],
  orderId: string
): Order[] {
  return orders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      paymentStatus: "refunded" as PaymentStatus,
      updatedAt: new Date().toISOString(),
    };
  });
}

// ============================================================
// STOCK ACTIONS
// ============================================================

export function reduceStock(
  products: Product[],
  items: { productId: string; quantity: number }[]
): Product[] {
  return products.map((product) => {
    const item = items.find((i) => i.productId === product.id);
    if (!item) return product;
    const newStock = Math.max(0, product.stock - item.quantity);
    return {
      ...product,
      stock: newStock,
      visible: newStock === 0 ? false : product.visible,
      isVisible: newStock === 0 ? false : product.isVisible,
      status: newStock === 0 ? "out_of_stock" : product.status,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function restoreStock(
  products: Product[],
  items: { productId: string; quantity: number }[]
): Product[] {
  return products.map((product) => {
    const item = items.find((i) => i.productId === product.id);
    if (!item) return product;
    return {
      ...product,
      stock: product.stock + item.quantity,
      status: "active",
      visible: true,
      isVisible: true,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function updateStockThreshold(
  products: Product[],
  productId: string,
  threshold: number
): Product[] {
  return products.map((p) =>
    p.id === productId
      ? { ...p, lowStockThreshold: threshold, updatedAt: new Date().toISOString() }
      : p
  );
}

// ============================================================
// PRODUCT ACTIONS
// ============================================================

export function toggleFeatured(
  products: Product[],
  productId: string
): Product[] {
  return products.map((p) =>
    p.id === productId
      ? { ...p, featured: !p.featured, updatedAt: new Date().toISOString() }
      : p
  );
}

export function updateProduct(
  products: Product[],
  productId: string,
  updates: Partial<Product>
): Product[] {
  return products.map((p) =>
    p.id === productId
      ? { ...p, ...updates, updatedAt: new Date().toISOString() }
      : p
  );
}

export function deleteProduct(
  products: Product[],
  productId: string
): Product[] {
  return products.filter((p) => p.id !== productId);
}

export function duplicateProduct(
  products: Product[],
  productId: string
): Product[] {
  const product = products.find((item) => item.id === productId);
  if (!product) return products;

  const now = new Date().toISOString();
  const duplicateId = generateId("prod");
  const duplicate: Product = {
    ...product,
    id: duplicateId,
    name: `${product.name} Copy`,
    slug: `${product.slug}-copy-${duplicateId.slice(-4)}`,
    sku: `${product.sku}-COPY`,
    featured: false,
    createdAt: now,
    updatedAt: now,
  };

  return [duplicate, ...products];
}

export function toggleProductVisibility(
  products: Product[],
  productId: string
): Product[] {
  return products.map((product) => {
    if (product.id !== productId) return product;

    const nextVisible = product.visible === false || product.isVisible === false ? true : false;

    return {
      ...product,
      visible: nextVisible,
      isVisible: nextVisible,
      status: nextVisible ? "active" : "hidden",
      updatedAt: new Date().toISOString(),
    };
  });
}
export function bulkDeleteProducts(
  products: Product[],
  productIds: string[]
): Product[] {
  const idSet = new Set(productIds);
  return products.filter((product) => !idSet.has(product.id));
}

// ============================================================
// CUSTOMER ACTIONS
// ============================================================

export function updateCustomer(
  customers: Customer[],
  customerId: string,
  updates: Partial<Customer>
): Customer[] {
  return customers.map((c) =>
    c.id === customerId ? { ...c, ...updates } : c
  );
}

export function blockCustomer(
  customers: Customer[],
  customerId: string
): Customer[] {
  return customers.map((c) =>
    c.id === customerId
      ? { ...c, status: c.status === "blocked" ? "active" : "blocked" }
      : c
  );
}

// ============================================================
// COUPON ACTIONS
// ============================================================

export function createCoupon(
  coupons: Coupon[],
  coupon: Omit<Coupon, "id" | "createdAt" | "usedCount">
): Coupon[] {
  return [
    ...coupons,
    {
      ...coupon,
      id: generateId("coup"),
      usedCount: 0,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function generateCouponCode(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function toggleCouponStatus(
  coupons: Coupon[],
  couponId: string
): Coupon[] {
  return coupons.map((c) =>
    c.id === couponId
      ? { ...c, status: c.status === "active" ? "disabled" : "active" }
      : c
  );
}

export function updateCouponStatus(
  coupons: Coupon[],
  couponId: string
): Coupon[] {
  return toggleCouponStatus(coupons, couponId);
}

export function deleteCoupon(
  coupons: Coupon[],
  couponId: string
): Coupon[] {
  return coupons.filter((c) => c.id !== couponId);
}

// ============================================================
// PRODUCT DRAFT / PUBLISH ACTIONS
// ============================================================

export function createProductDraft(
  draft: ProductDraft,
  updates: Partial<ProductDraft>
): ProductDraft {
  return {
    ...draft,
    ...updates,
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

export function publishProduct(
  products: Product[],
  draft: ProductDraft
): Product[] {
  const now = new Date().toISOString();
  const newProduct: Product = {
    id: generateId("prod"),
    name: draft.name,
    slug: draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    sku: draft.sku || `SKU-${generateId("sku").slice(0, 8).toUpperCase()}`,
    description: draft.description,
    price: draft.price,
    compareAtPrice: draft.compareAtPrice,
    images: draft.images.length > 0 ? draft.images : ["/images/all-img/p-1.png"],
    category: draft.category || "Uncategorized",
    tags: draft.tags,
    variants: draft.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      stock: v.stock,
      price: v.price,
      sku: v.sku,
    })),
    stock: draft.quantity,
    lowStockThreshold: draft.lowStockThreshold,
    status: draft.quantity <= 0 ? "out_of_stock" : "active",
    featured: draft.featured,
    visible: draft.quantity > 0,
    isVisible: draft.quantity > 0,
    metaTitle: draft.metaTitle || draft.name,
    metaDescription: draft.metaDescription || draft.description.slice(0, 160),
    createdAt: now,
    updatedAt: now,
  };
  return [...products, newProduct];
}

// ============================================================
// BANNER ACTIONS
// ============================================================

export function toggleBannerActive(
  banners: Banner[],
  bannerId: string
): Banner[] {
  return banners.map((b) =>
    b.id === bannerId ? { ...b, active: !b.active } : b
  );
}

export function reorderBanners(
  banners: Banner[],
  orderedIds: string[]
): Banner[] {
  return orderedIds.map((id, index) => {
    const banner = banners.find((b) => b.id === id);
    return banner ? { ...banner, order: index + 1 } : banner!;
  });
}

// ============================================================
// RETURN ACTIONS
// ============================================================

export function updateReturnStatus(
  returns: ReturnRequest[],
  returnId: string,
  newStatus: ReturnStatus
): ReturnRequest[] {
  return returns.map((r) =>
    r.id === returnId
      ? { ...r, status: newStatus, updatedAt: new Date().toISOString() }
      : r
  );
}

// ============================================================
// NOTIFICATION ACTIONS
// ============================================================

export function markNotificationRead(
  notifications: AppNotification[],
  notificationId: string
): AppNotification[] {
  return notifications.map((n) =>
    n.id === notificationId ? { ...n, read: true } : n
  );
}

export function markAllNotificationsRead(
  notifications: AppNotification[]
): AppNotification[] {
  return notifications.map((n) => ({ ...n, read: true }));
}

export function createNotification(
  notifications: AppNotification[],
  notification: Omit<AppNotification, "id" | "createdAt" | "read">
): AppNotification[] {
  return [
    {
      ...notification,
      id: generateId("notif"),
      read: false,
      createdAt: new Date().toISOString(),
    },
    ...notifications,
  ];
}

// ============================================================
// ACTIVITY LOG ACTIONS
// ============================================================

export function addActivityLog(
  logs: ActivityLog[],
  log: Omit<ActivityLog, "id" | "timestamp">
): ActivityLog[] {
  return [
    {
      ...log,
      id: generateId("log"),
      timestamp: new Date().toISOString(),
    },
    ...logs,
  ].slice(0, 200); // Keep last 200 logs
}

// ============================================================
// CSV EXPORT HELPER
// ============================================================

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string
): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
        return `"${str.replace(/"/g, '""')}"`;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

