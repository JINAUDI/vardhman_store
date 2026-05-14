import { getSupabaseBrowserClient } from "./admin-auth";

export type PromotionType =
  | "coupon_code"
  | "automatic_discount"
  | "category_offer"
  | "combo_offer"
  | "first_order_offer"
  | "free_shipping"
  | "buy_x_get_y";

export type DiscountType = "percentage" | "fixed_amount" | "free_shipping" | "buy_x_get_y";

export type PromotionDiscount = {
  id: string;
  code?: string | null;
  title?: string | null;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  promotion_type: PromotionType;
  applies_to: string;
  product_ids?: string[] | null;
  category_ids?: string[] | null;
  category_slugs?: string[] | null;
  collection_ids?: string[] | null;
  tags?: string[] | null;
  minimum_order_amount?: number | null;
  maximum_discount_amount?: number | null;
  usage_limit?: number | null;
  used_count?: number | null;
  usage_limit_per_customer?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  is_active?: boolean | null;
  is_first_order_only?: boolean | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  combine_with_other_discounts?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PromotionRedemption = {
  id: string;
  discount_id: string;
  order_id?: string | null;
  auth_user_id?: string | null;
  customer_email?: string | null;
  code?: string | null;
  discount_amount?: number | null;
  created_at: string;
};

export type PromotionProductOption = {
  id: string;
  title?: string | null;
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  category_slug?: string | null;
};

export type PromotionDashboardData = {
  promotions: PromotionDiscount[];
  redemptions: PromotionRedemption[];
  products: PromotionProductOption[];
};

export type PromotionPayload = Omit<Partial<PromotionDiscount>, "id" | "created_at" | "updated_at" | "used_count">;

export async function getPromotionDashboardData(): Promise<PromotionDashboardData> {
  const supabase = getSupabaseBrowserClient();

  const [promotionsResult, redemptionsResult, productsResult] = await Promise.all([
    supabase
      .from("discounts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("discount_redemptions")
      .select("id,discount_id,order_id,auth_user_id,customer_email,code,discount_amount,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("products")
      .select("id,title,name,sku,category,category_slug")
      .order("title", { ascending: true })
      .limit(250)
  ]);

  if (promotionsResult.error) throw promotionsResult.error;
  if (redemptionsResult.error) throw redemptionsResult.error;
  if (productsResult.error) throw productsResult.error;

  return {
    promotions: (promotionsResult.data || []) as PromotionDiscount[],
    redemptions: (redemptionsResult.data || []) as PromotionRedemption[],
    products: (productsResult.data || []) as PromotionProductOption[]
  };
}

export async function createPromotion(payload: PromotionPayload) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("discounts")
    .insert({ ...payload, updated_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error) throw error;
  return data as PromotionDiscount;
}

export async function updatePromotion(id: string, payload: PromotionPayload) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("discounts")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as PromotionDiscount;
}

export async function deletePromotion(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("discounts").delete().eq("id", id);
  if (error) throw error;
}
