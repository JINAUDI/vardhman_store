"use client";

import { getCurrentAdmin, getSupabaseBrowserClient } from "./admin-auth";

export type AnalyticsDateRange = {
  start: string;
  end: string;
};

export type AnalyticsOrder = {
  id: string;
  order_number?: string | null;
  total?: number | null;
  subtotal?: number | null;
  discount?: number | null;
  delivery_charge?: number | null;
  status?: string | null;
  order_status?: string | null;
  fulfillment_status?: string | null;
  refund_status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  customer_email?: string | null;
  customer_id?: string | null;
  auth_user_id?: string | null;
  created_at?: string | null;
};

export type AnalyticsOrderItem = {
  id?: string | null;
  order_id?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  price?: number | null;
  total?: number | null;
  created_at?: string | null;
};

export type AnalyticsProduct = {
  id: string;
  title?: string | null;
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  category_slug?: string | null;
  price?: number | null;
};

export type AnalyticsWishlistRow = {
  id?: string | null;
  product_id?: string | null;
  auth_user_id?: string | null;
  customer_id?: string | null;
  session_id?: string | null;
  created_at?: string | null;
};

export type AnalyticsEvent = {
  id?: string | null;
  event_name?: string | null;
  event_type?: string | null;
  session_id?: string | null;
  auth_user_id?: string | null;
  customer_id?: string | null;
  product_id?: string | null;
  order_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type BusinessAnalyticsData = {
  range: AnalyticsDateRange;
  orders: AnalyticsOrder[];
  historicalOrders: AnalyticsOrder[];
  orderItems: AnalyticsOrderItem[];
  products: AnalyticsProduct[];
  wishlist: AnalyticsWishlistRow[];
  events: AnalyticsEvent[];
};

type SelectOptions = {
  range?: AnalyticsDateRange;
  lteEndOnly?: boolean;
  required?: boolean;
  limit?: number;
};

function applyRange(query: any, range?: AnalyticsDateRange, lteEndOnly = false) {
  if (!range) return query;
  let nextQuery = query.lte("created_at", range.end);
  if (!lteEndOnly) {
    nextQuery = nextQuery.gte("created_at", range.start);
  }
  return nextQuery;
}

async function selectRows<T>(table: string, selectClauses: string[], options: SelectOptions = {}): Promise<T[]> {
  const supabase = getSupabaseBrowserClient();
  let lastError: unknown = null;

  for (const clause of selectClauses) {
    let query = supabase.from(table).select(clause).order("created_at", { ascending: false }).limit(options.limit || 5000);
    query = applyRange(query, options.range, options.lteEndOnly);
    const { data, error } = await query;
    if (!error) return (data || []) as T[];
    lastError = error;
  }

  if (options.required) {
    throw lastError instanceof Error ? lastError : new Error(`Unable to load ${table}.`);
  }

  return [];
}

async function selectOrderItems(orderIds: string[]) {
  if (!orderIds.length) return [];

  const supabase = getSupabaseBrowserClient();
  const selectClauses = [
    "id,order_id,product_id,product_name,quantity,price,total,created_at",
    "id,order_id,product_id,product_name,quantity,price,total",
    "order_id,product_id,product_name,quantity,price,total"
  ];
  let lastError: unknown = null;

  for (const clause of selectClauses) {
    const { data, error } = await supabase
      .from("order_items")
      .select(clause)
      .in("order_id", orderIds.slice(0, 1000))
      .limit(10000);

    if (!error) return (data || []) as AnalyticsOrderItem[];
    lastError = error;
  }

  console.warn("Unable to load order_items for analytics.", lastError);
  return [];
}

export async function getBusinessAnalytics(range: AnalyticsDateRange): Promise<BusinessAnalyticsData> {
  await getCurrentAdmin();

  const orders = await selectRows<AnalyticsOrder>(
    "orders",
    [
      "id,order_number,total,subtotal,discount,delivery_charge,status,order_status,fulfillment_status,refund_status,payment_method,payment_status,customer_email,customer_id,auth_user_id,created_at",
      "id,order_number,total,subtotal,discount,delivery_charge,status,payment_method,payment_status,customer_email,customer_id,auth_user_id,created_at",
      "id,total,status,payment_method,customer_email,auth_user_id,created_at"
    ],
    { range, required: true }
  );

  const historicalOrders = await selectRows<AnalyticsOrder>(
    "orders",
    [
      "id,total,status,order_status,refund_status,customer_email,customer_id,auth_user_id,created_at",
      "id,total,status,customer_email,auth_user_id,created_at"
    ],
    { range, lteEndOnly: true, required: false, limit: 10000 }
  );

  const orderItems = await selectOrderItems(orders.map((order) => order.id).filter(Boolean));

  const [products, wishlist, eventRows] = await Promise.all([
    selectRows<AnalyticsProduct>(
      "products",
      [
        "id,title,name,sku,category,category_slug,price,created_at",
        "id,title,name,sku,category,category_slug,price",
        "id,title,name,category,price"
      ],
      { required: false, limit: 2000 }
    ),
    selectRows<AnalyticsWishlistRow>(
      "wishlist",
      [
        "id,product_id,auth_user_id,customer_id,session_id,created_at",
        "id,product_id,session_id,created_at",
        "product_id,created_at"
      ],
      { range, required: false, limit: 10000 }
    ),
    selectRows<AnalyticsEvent>(
      "analytics_events",
      [
        "id,event_name,session_id,auth_user_id,customer_id,product_id,order_id,metadata,created_at",
        "id,event_type,session_id,auth_user_id,customer_id,product_id,order_id,metadata,created_at"
      ],
      { range, required: false, limit: 10000 }
    )
  ]);

  return {
    range,
    orders,
    historicalOrders,
    orderItems,
    products,
    wishlist,
    events: eventRows.map((event) => ({ ...event, event_name: event.event_name || event.event_type || "" }))
  };
}
