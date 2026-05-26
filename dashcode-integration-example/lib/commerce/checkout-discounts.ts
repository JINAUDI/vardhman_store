import { computeDiscountPreview, type CartLineLike, type ProductLike } from "@/lib/commerce/merchandising";
import { getComputedCouponStatus } from "@/lib/store/coupon-status";
import type { Collection, Coupon } from "@/lib/store/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapSupabaseRowToCollection, mapSupabaseRowToDiscount } from "@/lib/supabase/marketing";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type CheckoutDiscountResult = {
  coupon?: Coupon;
  discountAmount: number;
  shippingDiscountAmount: number;
  total: number;
  subtotal: number;
  message?: string;
};

function isAutomaticCheckoutCoupon(coupon: Coupon) {
  return coupon.method === "automatic" || coupon.discountCategory === "buy_x_get_y";
}

async function getCheckoutDiscountData() {
  if (!isSupabaseConfigured()) {
    return { coupons: [] as Coupon[], collections: [] as Collection[] };
  }

  const supabase = createSupabaseAdminClient();
  const [discountResult, collectionResult] = await Promise.all([
    supabase.from("discounts").select("*").eq("status", "active"),
    supabase.from("collections").select("*").eq("is_active", true),
  ]);

  if (discountResult.error) {
    throw discountResult.error;
  }

  return {
    coupons: (discountResult.data ?? []).map((row) =>
      mapSupabaseRowToDiscount(row as Record<string, unknown>)
    ),
    collections: collectionResult.error
      ? []
      : (collectionResult.data ?? []).map((row) =>
          mapSupabaseRowToCollection(row as Record<string, unknown>)
        ),
  };
}

export async function getBestAutomaticCheckoutDiscount(
  cartLines: CartLineLike[],
  products: ProductLike[]
): Promise<CheckoutDiscountResult> {
  return getCheckoutDiscount(cartLines, products);
}

export async function getCheckoutDiscount(
  cartLines: CartLineLike[],
  products: ProductLike[],
  code?: string
): Promise<CheckoutDiscountResult> {
  const subtotal = cartLines.reduce(
    (sum, line) => sum + (Number(line.price) || 0) * (Number(line.quantity) || 0),
    0
  );

  try {
    const { coupons, collections } = await getCheckoutDiscountData();
    const normalizedCode = code?.trim().toUpperCase();
    const activeCoupons = coupons.filter(
      (coupon) => getComputedCouponStatus(coupon) === "active"
    );
    const candidates = normalizedCode
      ? activeCoupons.filter((coupon) => coupon.code.toUpperCase() === normalizedCode)
      : activeCoupons.filter(isAutomaticCheckoutCoupon);

    const best = candidates
      .map((coupon) => ({
        coupon,
        preview: computeDiscountPreview(coupon, cartLines, products, collections),
      }))
      .filter(({ preview }) => preview.discountAmount > 0 || preview.shippingDiscountAmount > 0)
      .sort(
        (left, right) =>
          right.preview.discountAmount +
          right.preview.shippingDiscountAmount -
          (left.preview.discountAmount + left.preview.shippingDiscountAmount)
      )[0];

    if (!best) {
      return {
        discountAmount: 0,
        shippingDiscountAmount: 0,
        subtotal,
        total: subtotal,
        message: normalizedCode ? "Coupon code is invalid or not applicable to this cart." : undefined,
      };
    }

    return {
      coupon: best.coupon,
      discountAmount: best.preview.discountAmount,
      shippingDiscountAmount: best.preview.shippingDiscountAmount,
      subtotal,
      total: best.preview.total,
    };
  } catch {
    return {
      discountAmount: 0,
      shippingDiscountAmount: 0,
      subtotal,
      total: subtotal,
      message: "Unable to apply discounts right now.",
    };
  }
}
