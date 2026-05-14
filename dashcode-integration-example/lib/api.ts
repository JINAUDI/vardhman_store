const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API request failed");
  }

  return data as T;
}

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
  getProducts: (params = "") => request<ProductListResponse>(`/products${params}`),
  createProduct: (payload: Partial<Product>) => request<Product>("/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id: string, payload: Partial<Product>) => request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProduct: (id: string) => request<{ message: string }>(`/products/${id}`, { method: "DELETE" }),
  toggleVisibility: (id: string, visible: boolean) => request<Product>(`/products/${id}/visibility`, { method: "PUT", body: JSON.stringify({ visible }) }),
  getOrders: (params = "") => request<{ items: Order[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(`/orders${params}`),
  updateOrder: (id: string, payload: Partial<Order>) => request<Order>(`/orders/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  getWishlistAnalytics
};
