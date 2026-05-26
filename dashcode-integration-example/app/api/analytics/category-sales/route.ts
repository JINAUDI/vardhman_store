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

const REVENUE_EXCLUDED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "failed",
  "refunded",
  "returned",
]);

type RangeValue = "daily" | "weekly" | "monthly" | "all";

type JsonRecord = Record<string, unknown>;

type ProductRow = {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  category?: string | null;
  category_slug?: string | null;
};

type OrderItemRow = {
  product_id?: string | null;
  productId?: string | null;
  product_name?: string | null;
  productName?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  total?: number | string | null;
};

type OrderWithItemsRow = {
  id?: string | null;
  status?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  total?: number | string | null;
  created_at?: string | null;
  order_items?: OrderItemRow[] | null;
};

type ProductAccumulator = {
  id: string;
  name: string;
  revenue: number;
  quantity: number;
  orderIds: Set<string>;
};

type CategoryAccumulator = {
  category: string;
  revenue: number;
  quantity: number;
  orderIds: Set<string>;
  products: Map<string, ProductAccumulator>;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeStatus(order: OrderWithItemsRow) {
  return readString(order.order_status ?? order.status, "pending").toLowerCase();
}

function getRangeStart(range: RangeValue, now = new Date()) {
  if (range === "daily") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (range === "weekly") {
    return new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "monthly") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 12);
    return start;
  }

  return null;
}

function toProductMap(rows: ProductRow[]) {
  const map = new Map<string, { name: string; category: string }>();

  for (const row of rows) {
    const id = readString(row.id);
    if (!id) continue;

    map.set(id, {
      name: readString(row.name ?? row.title, "Product"),
      category: readString(row.category ?? row.category_slug, "Other"),
    });
  }

  return map;
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
    const rangeParam = request.nextUrl.searchParams.get("range") as RangeValue | null;
    const range: RangeValue =
      rangeParam === "daily" || rangeParam === "weekly" || rangeParam === "monthly" || rangeParam === "all"
        ? rangeParam
        : "monthly";
    const rangeStart = getRangeStart(range);
    const supabase = createSupabaseAdminClient();
    let ordersQuery = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    if (rangeStart) {
      ordersQuery = ordersQuery.gte("created_at", rangeStart.toISOString());
    }

    const [ordersResult, productsResult] = await Promise.all([
      ordersQuery,
      supabase.from("products").select("*"),
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (productsResult.error) throw productsResult.error;

    const productsById = toProductMap((productsResult.data ?? []) as ProductRow[]);
    const categories = new Map<string, CategoryAccumulator>();
    const allProducts = new Map<string, ProductAccumulator>();
    let totalRevenue = 0;
    let totalQuantity = 0;
    const orderIds = new Set<string>();

    for (const order of (ordersResult.data ?? []) as OrderWithItemsRow[]) {
      const status = normalizeStatus(order);
      if (REVENUE_EXCLUDED_STATUSES.has(status)) continue;

      const orderId = readString(order.id);
      const items = Array.isArray(order.order_items) ? order.order_items : [];

      for (const item of items) {
        const productId = readString(item.product_id ?? item.productId);
        const productInfo = productId ? productsById.get(productId) : undefined;
        const productName = productInfo?.name || readString(item.product_name ?? item.productName, "Product");
        const categoryName = productInfo?.category || "Other";
        const quantity = Math.max(0, readNumber(item.quantity));
        const itemTotal = Math.max(0, readNumber(item.total, readNumber(item.price) * quantity));

        if (!itemTotal && !quantity) continue;

        if (!categories.has(categoryName)) {
          categories.set(categoryName, {
            category: categoryName,
            revenue: 0,
            quantity: 0,
            orderIds: new Set(),
            products: new Map(),
          });
        }

        const category = categories.get(categoryName)!;
        const productKey = productId || productName;
        const updateProduct = (map: Map<string, ProductAccumulator>) => {
          if (!map.has(productKey)) {
            map.set(productKey, {
              id: productId || productKey,
              name: productName,
              revenue: 0,
              quantity: 0,
              orderIds: new Set(),
            });
          }

          const product = map.get(productKey)!;
          product.revenue += itemTotal;
          product.quantity += quantity;
          if (orderId) product.orderIds.add(orderId);
        };

        category.revenue += itemTotal;
        category.quantity += quantity;
        if (orderId) {
          category.orderIds.add(orderId);
          orderIds.add(orderId);
        }
        updateProduct(category.products);
        updateProduct(allProducts);

        totalRevenue += itemTotal;
        totalQuantity += quantity;
      }
    }

    const categoryRows = Array.from(categories.values())
      .map((category) => ({
        category: category.category,
        revenue: Number(category.revenue.toFixed(2)),
        quantity: category.quantity,
        orderCount: category.orderIds.size,
        percentage: totalRevenue ? Number(((category.revenue / totalRevenue) * 100).toFixed(2)) : 0,
        topProducts: Array.from(category.products.values())
          .sort((left, right) => right.revenue - left.revenue)
          .slice(0, 4)
          .map((product) => ({
            id: product.id,
            name: product.name,
            revenue: Number(product.revenue.toFixed(2)),
            quantity: product.quantity,
            orderCount: product.orderIds.size,
          })),
      }))
      .sort((left, right) => right.revenue - left.revenue);

    const topProducts = Array.from(allProducts.values())
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 8)
      .map((product) => ({
        id: product.id,
        name: product.name,
        revenue: Number(product.revenue.toFixed(2)),
        quantity: product.quantity,
        orderCount: product.orderIds.size,
      }));

    return NextResponse.json(
      {
        status: "success",
        message: "Category sales fetched successfully",
        data: {
          range,
          categories: categoryRows,
          topProducts,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalQuantity,
          orderCount: orderIds.size,
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
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch category sales from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
