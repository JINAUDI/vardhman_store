"use client";

import { getCurrentAdmin, getSupabaseBrowserClient } from "./admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function supabaseRequest<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase wishlist env is not configured");
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/+$/g, "")}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Supabase request failed");
  }

  return data as T;
}

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));
}

function normalizeList(value: unknown) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function omitEmpty<T extends Record<string, unknown>>(payload: T) {
  return Object.entries(payload).reduce<Record<string, unknown>>((nextPayload, [key, value]) => {
    if (value !== undefined) nextPayload[key] = value;
    return nextPayload;
  }, {});
}

function normalizeProduct(row: Record<string, any>): Product {
  const title = row.title || row.name || "Product";

  return {
    ...row,
    _id: row.id,
    id: row.id,
    name: row.name || title,
    title,
    sku: row.sku || "",
    description: row.description || "",
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    category: row.category || row.category_slug || "Catalog",
    image: row.image || row.image_url || "",
    image_url: row.image_url || row.image || "",
    images: normalizeList(row.images),
    visible: row.visible !== false && row.is_active !== false && row.status !== "inactive",
    createdAt: row.created_at || row.createdAt || "",
    updated_at: row.updated_at || row.updatedAt || ""
  };
}

function productPayload(product: Partial<Product>) {
  const title = product.title || product.name;
  const visible = product.visible;

  return omitEmpty({
    title,
    name: product.name || title,
    slug: product.slug,
    meta_title: product.meta_title,
    meta_description: product.meta_description,
    canonical_url: product.canonical_url,
    og_image_url: product.og_image_url,
    price: product.price,
    compare_at_price: product.compare_at_price ?? product.compareAtPrice,
    sku: product.sku,
    stock: product.stock,
    reserved_stock: product.reserved_stock,
    available_stock: product.available_stock,
    low_stock_threshold: product.low_stock_threshold,
    track_inventory: product.track_inventory,
    allow_backorder: product.allow_backorder,
    inventory_status: product.inventory_status,
    category: product.category,
    category_slug: product.category_slug,
    image: product.image,
    image_url: product.image_url,
    images: normalizeList(product.images),
    specifications: product.specifications,
    faqs: product.faqs,
    delivery_days_min: product.delivery_days_min,
    delivery_days_max: product.delivery_days_max,
    return_policy: product.return_policy,
    warranty: product.warranty,
    brand: product.brand,
    related_product_ids: normalizeList(product.related_product_ids),
    badges: normalizeList(product.badges),
    tags: normalizeList(product.tags),
    search_keywords: product.search_keywords,
    is_hot: product.is_hot ?? product.isHot,
    is_best_seller: product.is_best_seller ?? product.isBestSeller,
    is_featured: product.is_featured ?? product.isFeatured,
    is_new: product.is_new ?? product.isNew,
    sales_count: product.sales_count,
    description: product.description,
    visible,
    is_active: visible,
    status: visible === undefined ? undefined : visible === false ? "inactive" : "active"
  });
}

function normalizeOrder(row: Record<string, any>, items: Record<string, any>[] = []): Order {
  const [firstName = row.customer_name || "Customer", ...lastNameParts] = String(row.customer_name || "").trim().split(/\s+/);

  return {
    ...row,
    _id: row.id,
    id: row.id,
    orderId: row.order_number || row.tracking_id || row.id,
    total: Number(row.total || 0),
    status: (row.order_status || row.status || "pending") as Order["status"],
    customer: {
      firstName,
      lastName: lastNameParts.join(" "),
      email: row.customer_email || ""
    },
    products: items.map((item) => ({
      name: item.product_name || "Product",
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0)
    })),
    createdAt: row.created_at || ""
  };
}

function statusPayload(status?: Order["status"]) {
  if (!status) return {};

  return {
    status,
    order_status: status,
    tracking_status: status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    fulfillment_status: status === "delivered" ? "delivered" : status === "shipped" ? "shipped" : undefined,
    refund_status: status === "refunded" ? "refunded" : status === "returned" ? "returned" : undefined,
    cancelled_at: status === "cancelled" ? new Date().toISOString() : undefined,
    refunded_at: status === "refunded" ? new Date().toISOString() : undefined,
    delivered_at: status === "delivered" ? new Date().toISOString() : undefined,
    updated_at: new Date().toISOString()
  };
}

async function getProducts(params = ""): Promise<ProductListResponse> {
  await getCurrentAdmin();
  const searchParams = new URLSearchParams(params.replace(/^\?/, ""));
  const includeHidden = searchParams.get("includeHidden") === "true";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 50)));
  const search = String(searchParams.get("search") || "").trim();
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (!includeHidden) {
    query = query.neq("visible", false).neq("is_active", false);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,name.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: (data || []).map((row) => normalizeProduct(row as Record<string, any>)),
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit))
    }
  };
}

async function createProduct(payload: Partial<Product>): Promise<Product> {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("products")
    .insert(productPayload({ ...payload, visible: payload.visible ?? true }))
    .select("*")
    .single();

  if (error) throw error;
  return normalizeProduct(data as Record<string, any>);
}

async function updateProduct(id: string, payload: Partial<Product>): Promise<Product> {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  let query = supabase.from("products").update(productPayload(payload));

  if (isUuid(id)) {
    query = query.eq("id", id);
  } else if (payload.slug) {
    query = query.eq("slug", payload.slug);
  } else if (payload.sku) {
    query = query.eq("sku", payload.sku);
  } else {
    throw new Error("A Supabase product id, slug, or SKU is required.");
  }

  const { data, error } = await query.select("*").limit(1).single();
  if (error) throw error;
  return normalizeProduct(data as Record<string, any>);
}

async function deleteProduct(id: string) {
  await getCurrentAdmin();
  if (!isUuid(id)) throw new Error("A Supabase product id is required to delete a product.");
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  return { message: "Product deleted." };
}

async function toggleVisibility(id: string, visible: boolean): Promise<Product> {
  return updateProduct(id, { visible });
}

async function getOrders(params = ""): Promise<{ items: Order[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
  await getCurrentAdmin();
  const searchParams = new URLSearchParams(params.replace(/^\?/, ""));
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 25)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const supabase = getSupabaseBrowserClient();
  const { data: orders, error, count } = await supabase
    .from("orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const orderIds = (orders || []).map((order: any) => order.id).filter(Boolean);
  const { data: orderItems, error: itemsError } = orderIds.length
    ? await supabase.from("order_items").select("order_id,product_name,quantity,price,total").in("order_id", orderIds)
    : { data: [], error: null };

  if (itemsError) throw itemsError;

  const itemsByOrder = new Map<string, Record<string, any>[]>();
  (orderItems || []).forEach((item: any) => {
    const current = itemsByOrder.get(item.order_id) || [];
    current.push(item);
    itemsByOrder.set(item.order_id, current);
  });

  return {
    items: (orders || []).map((order: any) => normalizeOrder(order, itemsByOrder.get(order.id) || [])),
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit))
    }
  };
}

async function updateOrder(id: string, payload: Partial<Order>): Promise<Order> {
  await getCurrentAdmin();
  if (!isUuid(id)) throw new Error("A Supabase order id is required to update an order.");
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("orders")
    .update(omitEmpty(statusPayload(payload.status)))
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeOrder(data as Record<string, any>);
}

export type Product = {
  _id: string;
  id?: string;
  name: string;
  title?: string;
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  og_image_url?: string;
  price: number;
  sku: string;
  stock: number;
  reserved_stock?: number;
  available_stock?: number;
  low_stock_threshold?: number;
  track_inventory?: boolean;
  allow_backorder?: boolean;
  inventory_status?: string;
  category: string;
  category_slug?: string;
  image?: string;
  image_url?: string;
  images?: string[];
  specifications?: Record<string, string> | string;
  faqs?: Array<{ question: string; answer: string }> | string;
  delivery_days_min?: number;
  delivery_days_max?: number;
  return_policy?: string;
  warranty?: string;
  brand?: string;
  related_product_ids?: string[];
  badges?: string[] | string;
  tags?: string[] | string;
  search_keywords?: string;
  is_hot?: boolean;
  isHot?: boolean;
  is_best_seller?: boolean;
  isBestSeller?: boolean;
  is_featured?: boolean;
  isFeatured?: boolean;
  is_new?: boolean;
  isNew?: boolean;
  sales_count?: number;
  compare_at_price?: number;
  compareAtPrice?: number;
  description: string;
  visible: boolean;
  createdAt: string;
  updated_at?: string;
};

export type ProductListResponse = {
  items: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type Order = {
  _id: string;
  id?: string;
  orderId: string;
  total: number;
  status: "pending" | "shipped" | "delivered" | "cancelled" | "refunded" | "returned";
  customer: {
    firstName: string;
    lastName: string;
    email: string;
  };
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
};

export type WishlistRecord = {
  id: string;
  customer_id?: string | null;
  auth_user_id?: string | null;
  session_id?: string | null;
  product_id: string;
  created_at: string;
};

export type WishlistProduct = {
  id: string;
  title?: string;
  name?: string;
  price?: number;
  stock?: number;
  category?: string;
  category_slug?: string;
  image_url?: string;
  image?: string;
};

export type WishlistAnalyticsItem = WishlistRecord & {
  productName: string;
  productPrice: number;
  productStock: number;
  productCategory: string;
};

export type WishlistProductSummary = {
  productId: string;
  productName: string;
  total: number;
};

export type WishlistAnalyticsResponse = {
  items: WishlistAnalyticsItem[];
  total: number;
  mostWishlisted: WishlistProductSummary[];
};

async function getWishlistAnalytics(): Promise<WishlistAnalyticsResponse> {
  const [wishlistRows, products] = await Promise.all([
    supabaseRequest<WishlistRecord[]>("/wishlist?select=*&order=created_at.desc"),
    supabaseRequest<WishlistProduct[]>("/products?select=id,title,name,price,stock,category,category_slug,image_url,image")
  ]);

  const productsById = new Map(products.map((product) => [product.id, product]));
  const counts = new Map<string, WishlistProductSummary>();

  const items = wishlistRows.map((row) => {
    const product = productsById.get(row.product_id);
    const productName = product?.title || product?.name || row.product_id;
    const current = counts.get(row.product_id) || {
      productId: row.product_id,
      productName,
      total: 0
    };
    current.total += 1;
    counts.set(row.product_id, current);

    return {
      ...row,
      productName,
      productPrice: Number(product?.price || 0),
      productStock: Number(product?.stock || 0),
      productCategory: product?.category || product?.category_slug || "Catalog"
    };
  });

  return {
    items,
    total: items.length,
    mostWishlisted: Array.from(counts.values())
      .sort((left, right) => right.total - left.total)
      .slice(0, 8)
  };
}

export const api = {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleVisibility,
  getOrders,
  updateOrder,
  getWishlistAnalytics
};
