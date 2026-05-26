import type { Coupon } from "@/lib/store/types";

export type ComputedCouponStatus = Coupon["status"] | "exhausted";

function getCouponEndDate(coupon: Partial<Coupon>) {
  const rawDates = [coupon.endsAt, coupon.expiresAt].filter(Boolean);

  for (const rawDate of rawDates) {
    const date = new Date(rawDate as string);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

export function isCouponExpired(coupon: Partial<Coupon>, now = new Date()) {
  const endDate = getCouponEndDate(coupon);
  return Boolean(endDate && endDate.getTime() <= now.getTime());
}

export function isCouponExhausted(coupon: Partial<Coupon>) {
  const usageLimit = Number(coupon.usageLimit ?? 0);
  const usedCount = Number(coupon.usedCount ?? 0);

  return Number.isFinite(usageLimit) && usageLimit > 0 && usedCount >= usageLimit;
}

export function canCouponBeActive(coupon: Partial<Coupon>, now = new Date()) {
  return !isCouponExpired(coupon, now) && !isCouponExhausted(coupon);
}

export function getComputedCouponStatus(coupon: Partial<Coupon>, now = new Date()): ComputedCouponStatus {
  if (isCouponExpired(coupon, now)) return "expired";
  if (isCouponExhausted(coupon)) return "exhausted";
  if (coupon.status === "disabled") return "disabled";
  if (coupon.status === "expired") return "expired";

  return "active";
}

export function getPersistedCouponStatus(coupon: Partial<Coupon>, now = new Date()): Coupon["status"] {
  const computedStatus = getComputedCouponStatus(coupon, now);
  return computedStatus === "exhausted" ? "expired" : computedStatus;
}
