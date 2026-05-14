"use client";

import { getCurrentAdmin, getSupabaseBrowserClient } from "./admin-auth";

export type ReviewModerationStatus = "pending" | "approved" | "rejected";

export type ReviewProduct = {
  id?: string | null;
  title?: string | null;
  name?: string | null;
  sku?: string | null;
};

export type ReviewCustomer = {
  id?: string | null;
  full_name?: string | null;
  email?: string | null;
};

export type ReviewRow = {
  id: string;
  product_id: string;
  order_id?: string | null;
  auth_user_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  rating: number;
  comment?: string | null;
  image_urls?: string[] | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  moderation_status: ReviewModerationStatus;
  status?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at?: string | null;
  products?: ReviewProduct | ReviewProduct[] | null;
  customers?: ReviewCustomer | ReviewCustomer[] | null;
};

export type ProductReviewStats = {
  productId: string;
  average: number;
  count: number;
};

function normalizeReview(row: ReviewRow): ReviewRow {
  const moderationStatus = (row.moderation_status || (row.is_approved ? "approved" : "pending")) as ReviewModerationStatus;
  return {
    ...row,
    rating: Math.min(5, Math.max(1, Number(row.rating || 5))),
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    moderation_status: moderationStatus,
    is_approved: moderationStatus === "approved"
  };
}

async function getReviewRows(selectClause: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(selectClause)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data || []) as ReviewRow[]).map(normalizeReview);
}

export async function getReviews() {
  await getCurrentAdmin();

  try {
    return await getReviewRows(
      "id,product_id,order_id,auth_user_id,customer_id,customer_name,customer_email,rating,comment,image_urls,is_verified_purchase,is_approved,moderation_status,status,admin_note,created_at,updated_at,products(id,title,name,sku),customers(id,full_name,email)"
    );
  } catch {
    return getReviewRows(
      "id,product_id,order_id,auth_user_id,customer_id,customer_name,customer_email,rating,comment,image_urls,is_verified_purchase,is_approved,moderation_status,status,admin_note,created_at,updated_at"
    );
  }
}

export async function updateReviewModeration(
  reviewId: string,
  moderationStatus: ReviewModerationStatus,
  adminNote?: string
) {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const payload: Partial<ReviewRow> = {
    moderation_status: moderationStatus,
    status: moderationStatus,
    is_approved: moderationStatus === "approved"
  };

  if (adminNote !== undefined) {
    payload.admin_note = adminNote;
  }

  const { data, error } = await supabase
    .from("reviews")
    .update(payload)
    .eq("id", reviewId)
    .select("id,product_id,order_id,auth_user_id,customer_id,customer_name,customer_email,rating,comment,image_urls,is_verified_purchase,is_approved,moderation_status,status,admin_note,created_at,updated_at")
    .single();

  if (error) throw error;
  return normalizeReview(data as ReviewRow);
}

export async function deleteReview(reviewId: string) {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) throw error;
}

export async function getProductReviewStats() {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("product_id,rating")
    .eq("is_approved", true)
    .eq("moderation_status", "approved");

  if (error) throw error;

  const statsByProduct = new Map<string, { total: number; count: number }>();
  (data || []).forEach((row: { product_id?: string | null; rating?: number | null }) => {
    if (!row.product_id) return;
    const current = statsByProduct.get(row.product_id) || { total: 0, count: 0 };
    current.count += 1;
    current.total += Number(row.rating || 0);
    statsByProduct.set(row.product_id, current);
  });

  return Array.from(statsByProduct.entries()).reduce<Record<string, ProductReviewStats>>((nextStats, [productId, stat]) => {
    nextStats[productId] = {
      productId,
      average: stat.count ? stat.total / stat.count : 0,
      count: stat.count
    };
    return nextStats;
  }, {});
}
