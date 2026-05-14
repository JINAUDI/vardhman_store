"use client";

import { getCurrentAdmin, getSupabaseBrowserClient } from "./admin-auth";

export type InventoryProduct = {
  id: string;
  title?: string | null;
  name?: string | null;
  slug?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_image_url?: string | null;
  sku?: string | null;
  category?: string | null;
  category_slug?: string | null;
  stock: number;
  reserved_stock: number;
  available_stock: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  inventory_status: "in_stock" | "low_stock" | "out_of_stock" | "not_tracked";
  badges?: string[] | null;
  tags?: string[] | null;
  search_keywords?: string | null;
  specifications?: Record<string, string> | null;
  faqs?: Array<{ question: string; answer: string }> | null;
  delivery_days_min?: number | null;
  delivery_days_max?: number | null;
  return_policy?: string | null;
  warranty?: string | null;
  brand?: string | null;
  related_product_ids?: string[] | null;
  is_hot?: boolean | null;
  is_best_seller?: boolean | null;
  is_featured?: boolean | null;
  is_new?: boolean | null;
  sales_count?: number | null;
  compare_at_price?: number | null;
  updated_at?: string | null;
};

export type InventoryLog = {
  id: string;
  product_id: string;
  order_id?: string | null;
  change_type: string;
  quantity_change: number;
  stock_before?: number | null;
  stock_after?: number | null;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
};

export async function getInventoryProducts() {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,title,name,slug,meta_title,meta_description,canonical_url,og_image_url,sku,category,category_slug,stock,reserved_stock,available_stock,low_stock_threshold,track_inventory,allow_backorder,inventory_status,badges,tags,search_keywords,specifications,faqs,delivery_days_min,delivery_days_max,return_policy,warranty,brand,related_product_ids,is_hot,is_best_seller,is_featured,is_new,sales_count,compare_at_price,updated_at")
    .order("inventory_status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as InventoryProduct[];
}

export async function getInventoryLogs(productId?: string) {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("inventory_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as InventoryLog[];
}

export async function adjustProductStock(productId: string, quantityChange: number, note: string) {
  const { admin } = await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("adjust_product_stock", {
    p_product_id: productId,
    p_quantity_change: quantityChange,
    p_note: note || "Dashboard stock adjustment",
    p_created_by: admin.email || "dashboard"
  });

  if (error) throw error;
  return data as InventoryProduct;
}

export async function updateInventorySettings(productId: string, payload: Partial<Pick<InventoryProduct, "low_stock_threshold" | "track_inventory" | "allow_backorder" | "stock">>) {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", productId)
    .select("id,title,name,slug,meta_title,meta_description,canonical_url,og_image_url,sku,category,category_slug,stock,reserved_stock,available_stock,low_stock_threshold,track_inventory,allow_backorder,inventory_status,badges,tags,search_keywords,specifications,faqs,delivery_days_min,delivery_days_max,return_policy,warranty,brand,related_product_ids,is_hot,is_best_seller,is_featured,is_new,sales_count,compare_at_price,updated_at")
    .single();

  if (error) throw error;
  return data as InventoryProduct;
}

export async function restoreOrderInventory(orderId: string, note: string) {
  const { admin } = await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("restore_order_inventory", {
    p_order_id: orderId,
    p_note: note || "Order cancelled/refunded from dashboard",
    p_created_by: admin.email || "dashboard"
  });

  if (error) throw error;
  return data as boolean;
}
