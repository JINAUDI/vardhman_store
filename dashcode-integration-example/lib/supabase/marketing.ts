import type { Collection, CollectionCondition, Coupon } from "@/lib/store/types";
import { getPersistedCouponStatus } from "@/lib/store/coupon-status";
import { slugifyCatalogValue } from "@/lib/supabase/catalog";

type JsonRecord = Record<string, unknown>;

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function readIsoDate(value: unknown, fallback = new Date().toISOString()) {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function readConditions(value: unknown): CollectionCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((condition, index) => {
      const record = condition as JsonRecord;
      const field = readString(record.field);
      const operator = readString(record.operator);
      const conditionValue = readString(record.value);

      if (!field || !operator) {
        return null;
      }

      return {
        id: readString(record.id, `condition_${index}`),
        field: field as CollectionCondition["field"],
        operator: operator as CollectionCondition["operator"],
        value: conditionValue,
      };
    })
    .filter((condition): condition is CollectionCondition => Boolean(condition));
}

export function mapSupabaseRowToDiscount(row: JsonRecord): Coupon {
  const method = readString(row.method, "code") as Coupon["method"];
  const startsAt = readOptionalString(row.starts_at ?? row.startsAt);
  const endsAt = readOptionalString(row.ends_at ?? row.endsAt);
  const expiresAt = readIsoDate(endsAt ?? row.expires_at ?? row.expiresAt);
  const usageLimit = readNumber(row.usage_limit ?? row.usageLimit, 0);
  const usedCount = readNumber(row.used_count ?? row.usedCount, 0);
  const rawStatus = readString(row.status, "active") as Coupon["status"];

  return {
    id: readString(row.id),
    title: readOptionalString(row.title),
    code: readString(row.code),
    method,
    type: readString(row.type, "percentage") as Coupon["type"],
    valueType: readString(row.value_type ?? row.valueType, "percentage") as Coupon["valueType"],
    discountCategory: readString(row.discount_category ?? row.discountCategory, "product_discount") as Coupon["discountCategory"],
    value: readNumber(row.value, 0),
    targetScope: readString(row.target_scope ?? row.targetScope, "all_products") as Coupon["targetScope"],
    targetProductIds: readStringArray(row.target_product_ids ?? row.targetProductIds),
    targetCollectionIds: readStringArray(row.target_collection_ids ?? row.targetCollectionIds),
    targetCategorySlugs: readStringArray(row.target_category_slugs ?? row.targetCategorySlugs),
    minOrderAmount: readNumber(row.min_order_amount ?? row.minOrderAmount, 0),
    minQuantity: readNumber(row.min_quantity ?? row.minQuantity, 0) || undefined,
    requirementType: readString(row.requirement_type ?? row.requirementType, "none") as Coupon["requirementType"],
    maxDiscount: readNumber(row.max_discount ?? row.maxDiscount, 0) || undefined,
    usageLimit,
    usedCount,
    oncePerCustomer: readBoolean(row.once_per_customer ?? row.oncePerCustomer, false),
    expiresAt,
    startsAt,
    endsAt,
    status: getPersistedCouponStatus({
      expiresAt,
      endsAt,
      usageLimit,
      usedCount,
      status: rawStatus,
    }),
    eligibility: readString(row.eligibility, "all_customers") as Coupon["eligibility"],
    eligibleCustomerIds: readStringArray(row.eligible_customer_ids ?? row.eligibleCustomerIds),
    eligibleCustomerSegments: readStringArray(row.eligible_customer_segments ?? row.eligibleCustomerSegments),
    appliesTo: readString(row.applies_to ?? row.appliesTo, "all") as Coupon["appliesTo"],
    selectedProductIds: readStringArray(row.selected_product_ids ?? row.selectedProductIds),
    buyQuantity: readNumber(row.buy_quantity ?? row.buyQuantity, 0) || undefined,
    getQuantity: readNumber(row.get_quantity ?? row.getQuantity, 0) || undefined,
    buyTargetScope: readOptionalString(row.buy_target_scope ?? row.buyTargetScope) as Coupon["buyTargetScope"],
    buyProductIds: readStringArray(row.buy_product_ids ?? row.buyProductIds),
    buyCollectionIds: readStringArray(row.buy_collection_ids ?? row.buyCollectionIds),
    buyCategorySlugs: readStringArray(row.buy_category_slugs ?? row.buyCategorySlugs),
    getTargetScope: readOptionalString(row.get_target_scope ?? row.getTargetScope) as Coupon["getTargetScope"],
    getProductIds: readStringArray(row.get_product_ids ?? row.getProductIds),
    getCollectionIds: readStringArray(row.get_collection_ids ?? row.getCollectionIds),
    getCategorySlugs: readStringArray(row.get_category_slugs ?? row.getCategorySlugs),
    maximumUsesPerOrder: readNumber(row.maximum_uses_per_order ?? row.maximumUsesPerOrder, 0) || undefined,
    combinesWithProductDiscounts: readBoolean(row.combines_with_product_discounts ?? row.combinesWithProductDiscounts, false),
    combinesWithOrderDiscounts: readBoolean(row.combines_with_order_discounts ?? row.combinesWithOrderDiscounts, false),
    combinesWithShippingDiscounts: readBoolean(row.combines_with_shipping_discounts ?? row.combinesWithShippingDiscounts, false),
    salesChannels: readStringArray(row.sales_channels ?? row.salesChannels),
    tags: readStringArray(row.tags),
    regions: readStringArray(row.regions),
    autoGenerated: readBoolean(row.auto_generated ?? row.autoGenerated, false),
    createdAt: readIsoDate(row.created_at ?? row.createdAt),
    updatedAt: readOptionalString(row.updated_at ?? row.updatedAt),
  };
}

export function mapDiscountToSupabasePayload(discount: Partial<Coupon>) {
  const startsAt = discount.startsAt?.trim() || null;
  const endsAt = discount.endsAt?.trim() || discount.expiresAt?.trim() || null;
  const code = discount.code?.trim().toUpperCase() || null;
  const status = getPersistedCouponStatus({
    ...discount,
    endsAt: endsAt || undefined,
    expiresAt: endsAt || undefined,
  });

  return {
    title: discount.title?.trim() || null,
    code,
    method: discount.method || "code",
    type: discount.type || "percentage",
    value_type: discount.valueType || (discount.type === "flat" ? "fixed_amount" : "percentage"),
    discount_category: discount.discountCategory || "product_discount",
    value: discount.value ?? 0,
    target_scope: discount.targetScope || "all_products",
    target_product_ids: discount.targetProductIds ?? discount.selectedProductIds ?? [],
    target_collection_ids: discount.targetCollectionIds ?? [],
    target_category_slugs: discount.targetCategorySlugs ?? [],
    min_order_amount: discount.minOrderAmount ?? 0,
    min_quantity: discount.minQuantity ?? null,
    requirement_type: discount.requirementType || "none",
    max_discount: discount.maxDiscount ?? null,
    usage_limit: discount.usageLimit ?? 0,
    used_count: discount.usedCount ?? 0,
    once_per_customer: discount.oncePerCustomer ?? false,
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    eligibility: discount.eligibility || "all_customers",
    eligible_customer_ids: discount.eligibleCustomerIds ?? [],
    eligible_customer_segments: discount.eligibleCustomerSegments ?? [],
    buy_quantity: discount.buyQuantity ?? null,
    get_quantity: discount.getQuantity ?? null,
    buy_target_scope: discount.buyTargetScope ?? null,
    buy_product_ids: discount.buyProductIds ?? [],
    buy_collection_ids: discount.buyCollectionIds ?? [],
    buy_category_slugs: discount.buyCategorySlugs ?? [],
    get_target_scope: discount.getTargetScope ?? null,
    get_product_ids: discount.getProductIds ?? [],
    get_collection_ids: discount.getCollectionIds ?? [],
    get_category_slugs: discount.getCategorySlugs ?? [],
    maximum_uses_per_order: discount.maximumUsesPerOrder ?? null,
    combines_with_product_discounts: discount.combinesWithProductDiscounts ?? false,
    combines_with_order_discounts: discount.combinesWithOrderDiscounts ?? false,
    combines_with_shipping_discounts: discount.combinesWithShippingDiscounts ?? false,
    sales_channels: discount.salesChannels ?? [],
    tags: discount.tags ?? [],
    regions: discount.regions ?? [],
    auto_generated: discount.autoGenerated ?? false,
  };
}

export function mapSupabaseRowToCollection(row: JsonRecord): Collection {
  const title = readString(row.title, "Untitled Collection");

  return {
    id: readString(row.id),
    title,
    slug: readString(row.slug, slugifyCatalogValue(title)),
    description: readOptionalString(row.description),
    imageUrl: readOptionalString(row.image_url ?? row.imageUrl),
    collectionType: readString(row.collection_type ?? row.collectionType, "manual") as Collection["collectionType"],
    isActive: readBoolean(row.is_active ?? row.isActive, true),
    salesChannels: readStringArray(row.sales_channels ?? row.salesChannels),
    themeTemplate: readString(row.theme_template ?? row.themeTemplate, "default"),
    sortOrder: readNumber(row.sort_order ?? row.sortOrder, 0),
    sortType: readString(row.sort_type ?? row.sortType, "manual") as Collection["sortType"],
    conditionsMatch: readString(row.conditions_match ?? row.conditionsMatch, "all") as Collection["conditionsMatch"],
    conditions: readConditions(row.conditions),
    productIds: readStringArray(row.product_ids ?? row.productIds),
    tags: readStringArray(row.tags),
    createdAt: readIsoDate(row.created_at ?? row.createdAt),
    updatedAt: readIsoDate(row.updated_at ?? row.updatedAt ?? row.created_at),
  };
}

export function mapCollectionToSupabasePayload(collection: Partial<Collection>) {
  const title = collection.title?.trim() || "";

  return {
    title,
    slug: collection.slug?.trim() || slugifyCatalogValue(title),
    description: collection.description?.trim() || null,
    image_url: collection.imageUrl?.trim() || null,
    collection_type: collection.collectionType || "manual",
    is_active: collection.isActive ?? true,
    sales_channels: collection.salesChannels ?? [],
    theme_template: collection.themeTemplate?.trim() || "default",
    sort_order: collection.sortOrder ?? 0,
    sort_type: collection.sortType || "manual",
    conditions_match: collection.conditionsMatch || "all",
    conditions: collection.conditions ?? [],
    product_ids: collection.productIds ?? [],
    tags: collection.tags ?? [],
  };
}
