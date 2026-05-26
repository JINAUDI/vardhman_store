import type { Product, ProductDraft } from "@/lib/store/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatINR } from "@/lib/utils/currency";
import { isStorefrontSellableProduct } from "@/lib/supabase/inventory-alerts";

const DEFAULT_PRODUCT_IMAGE = "/images/all-img/p-1.png";
const CATEGORY_TAG_PREFIX = "__category:";
const SUBCATEGORY_TAG_PREFIX = "__subcategory:";
const NON_STOREFRONT_STATUSES = new Set([
  "draft",
  "archived",
  "inactive",
  "hidden",
  "out_of_stock",
  "unpublished",
  "disabled",
  "deleted",
]);

type JsonRecord = Record<string, unknown>;

export type StorefrontProduct = {
  id: string;
  img: string;
  images: string[];
  category: string;
  name: string;
  subtitle: string;
  desc: string;
  rating?: string;
  price: number;
  oldPrice?: string;
  percent?: string;
  brand: string;
  sku: string;
  stock: number;
  visible: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeProductStatus(value: unknown): Product["status"] {
  const status = String(value || "").toLowerCase();
  if (
    status === "active" ||
    status === "draft" ||
    status === "hidden" ||
    status === "out_of_stock" ||
    status === "archived"
  ) {
    return status;
  }

  return "active";
}

function readProductVisibility(row: JsonRecord) {
  const status = String(row.status || "").toLowerCase();
  const booleanFlags = [
    row.visible,
    row.is_visible,
    row.isVisible,
    row.is_active,
    row.isActive,
    row.active,
  ].filter((value): value is boolean => typeof value === "boolean");

  if (booleanFlags.some((value) => value === false)) return false;
  if (NON_STOREFRONT_STATUSES.has(status)) return false;
  if (booleanFlags.some((value) => value === true)) return true;
  return true;
}

function readInventoryStatus(value: unknown, availableStock: number, lowStockThreshold: number, trackInventory: boolean, allowBackorder: boolean): Product["inventoryStatus"] {
  if (value === "not_tracked" || !trackInventory) return "not_tracked";
  if (availableStock <= 0 && !allowBackorder) return "out_of_stock";
  if (availableStock <= lowStockThreshold) return "low_stock";
  return "in_stock";
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === "string" && item.length > 0
        );
      }
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function buildProductTags(tags: string[], category: string, subcategory?: string) {
  return dedupeStrings([
    ...tags,
    category ? `${CATEGORY_TAG_PREFIX}${category}` : "",
    subcategory ? `${SUBCATEGORY_TAG_PREFIX}${subcategory}` : "",
  ]);
}

function readIsoDate(value: unknown, fallback = new Date().toISOString()) {
  const dateValue = typeof value === "string" || value instanceof Date ? new Date(value) : null;

  if (dateValue && !Number.isNaN(dateValue.getTime())) {
    return dateValue.toISOString();
  }

  return fallback;
}

function readPrimaryImage(row: JsonRecord) {
  const images = readStringArray(row.images);
  const image = readNullableString(
    row.image ?? row.image_url ?? row.imageUrl ?? row.thumbnail_url ?? row.thumbnailUrl
  );

  if (images.length > 0) {
    return {
      image: images[0],
      images,
    };
  }

  if (image) {
    return {
      image,
      images: [image],
    };
  }

  return {
    image: DEFAULT_PRODUCT_IMAGE,
    images: [DEFAULT_PRODUCT_IMAGE],
  };
}

export function mapSupabaseRowToProduct(row: JsonRecord): Product {
  const { image, images } = readPrimaryImage(row);
  const name = readString(row.name ?? row.title, "Untitled Product");
  const description = readString(row.description ?? row.desc, "");
  const compareAtPrice = row.compare_at_price ?? row.compareAtPrice;
  const stock = readNumber(row.stock ?? row.quantity ?? row.inventory_quantity ?? row.inventoryQuantity, 0);
  const reservedStock = readNumber(row.reserved_stock ?? row.reservedStock, 0);
  const availableStock = readNumber(row.available_stock ?? row.availableStock, Math.max(stock - reservedStock, 0));
  const lowStockThreshold = readNumber(row.low_stock_threshold ?? row.lowStockThreshold, 10);
  const trackInventory = readBoolean(row.track_inventory ?? row.trackInventory, true);
  const allowBackorder = readBoolean(row.allow_backorder ?? row.allowBackorder, false);
  const inventoryStatus = readInventoryStatus(
    row.inventory_status ?? row.inventoryStatus,
    availableStock,
    lowStockThreshold,
    trackInventory,
    allowBackorder
  );
  const rowStatus = normalizeProductStatus(row.status);
  const status =
    inventoryStatus === "out_of_stock" && rowStatus === "active"
      ? "out_of_stock"
      : rowStatus;
  const visible = readProductVisibility({ ...row, status });

  return {
    id: readString(row.id),
    name,
    slug: readString(row.slug, slugify(name)),
    sku: readString(row.sku, `SKU-${readString(row.id).slice(0, 8).toUpperCase()}`),
    description,
    price: readNumber(row.price, 0),
    compareAtPrice:
      compareAtPrice === null || compareAtPrice === undefined
        ? undefined
        : readNumber(compareAtPrice, 0),
    images,
    category: readString(row.category ?? row.category_slug ?? row.categorySlug, "General"),
    tags: readStringArray(row.tags),
    variants: [],
    stock,
    reservedStock,
    availableStock,
    lowStockThreshold,
    trackInventory,
    allowBackorder,
    inventoryStatus,
    status,
    featured: readBoolean(row.featured, false),
    visible,
    isVisible: visible,
    metaTitle: readNullableString(row.meta_title ?? row.metaTitle) ?? name,
    metaDescription:
      readNullableString(row.meta_description ?? row.metaDescription) ??
      description,
    createdAt: readIsoDate(row.created_at ?? row.createdAt),
    updatedAt: readIsoDate(row.updated_at ?? row.updatedAt ?? row.created_at),
  };
}

export function mapProductToStorefrontProduct(product: Product): StorefrontProduct {
  const image = product.images[0] ?? DEFAULT_PRODUCT_IMAGE;
  const compareAtPrice =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? product.compareAtPrice
      : undefined;
  const percent = compareAtPrice
    ? `${Math.round(((compareAtPrice - product.price) / compareAtPrice) * 100)}%`
    : undefined;

  return {
    id: product.id,
    img: image,
    images: product.images.length > 0 ? product.images : [image],
    category: product.category,
    name: product.name,
    subtitle: product.metaDescription || product.description || product.category,
    desc: product.description || product.metaDescription || product.name,
    rating: "4.8",
    price: product.price,
    oldPrice: compareAtPrice ? formatINR(compareAtPrice) : undefined,
    percent,
    brand: product.category,
    sku: product.sku,
    stock: product.stock,
    visible: product.visible !== false && isStorefrontSellableProduct(product),
  };
}

export function mapDraftToSupabaseInsert(draft: ProductDraft) {
  const isPublished = draft.status === "published";
  const hasStock = draft.quantity > 0;
  const status = !isPublished ? "draft" : hasStock ? "active" : "out_of_stock";
  const visible = status === "active";

  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    price: draft.price,
    compare_at_price: draft.compareAtPrice ?? null,
    sku: draft.sku.trim(),
    stock: draft.quantity,
    reserved_stock: 0,
    low_stock_threshold: draft.lowStockThreshold,
    track_inventory: true,
    allow_backorder: false,
    category: draft.category,
    tags: buildProductTags(draft.tags, draft.category, draft.subcategory),
    image: draft.images[0] ?? DEFAULT_PRODUCT_IMAGE,
    visible,
    is_active: visible,
    featured: draft.featured,
    status,
    inventory_status: hasStock ? "in_stock" : "out_of_stock",
  };
}

export function mapProductUpdateToSupabaseUpdate(updates: Partial<Product>) {
  const nextUpdate: JsonRecord = {};

  if (typeof updates.name === "string") nextUpdate.name = updates.name.trim();
  if (typeof updates.description === "string") {
    nextUpdate.description = updates.description.trim();
  }
  if (typeof updates.price === "number") nextUpdate.price = updates.price;
  if ("compareAtPrice" in updates) {
    nextUpdate.compare_at_price =
      typeof updates.compareAtPrice === "number" ? updates.compareAtPrice : null;
  }
  if (typeof updates.sku === "string") nextUpdate.sku = updates.sku.trim();
  if (typeof updates.stock === "number") nextUpdate.stock = updates.stock;
  if (typeof updates.reservedStock === "number") nextUpdate.reserved_stock = updates.reservedStock;
  if (typeof updates.trackInventory === "boolean") nextUpdate.track_inventory = updates.trackInventory;
  if (typeof updates.allowBackorder === "boolean") nextUpdate.allow_backorder = updates.allowBackorder;
  if (typeof updates.category === "string") nextUpdate.category = updates.category;
  if (typeof updates.lowStockThreshold === "number") {
    nextUpdate.low_stock_threshold = updates.lowStockThreshold;
  }
  if (typeof updates.description === "string") {
    nextUpdate.meta_description = updates.description.trim();
  }
  if (typeof updates.name === "string") {
    nextUpdate.meta_title = updates.name.trim();
  }
  if (typeof updates.featured === "boolean") nextUpdate.featured = updates.featured;
  if (typeof updates.status === "string") {
    const status = normalizeProductStatus(updates.status);
    const visible = status === "active";
    nextUpdate.status = status;
    nextUpdate.visible = visible;
    nextUpdate.is_active = visible;
    if (status === "out_of_stock") nextUpdate.inventory_status = "out_of_stock";
  }
  if (typeof updates.visible === "boolean" || typeof updates.isVisible === "boolean") {
    const visible = updates.visible ?? updates.isVisible;
    nextUpdate.visible = visible;
    nextUpdate.is_active = visible;
    if (typeof updates.status !== "string") {
      nextUpdate.status = visible ? "active" : "hidden";
    }
  }
  if (Array.isArray(updates.images) && updates.images.length > 0) {
    nextUpdate.image = updates.images[0];
  }

  return nextUpdate;
}

export async function getVisibleStorefrontProducts() {
  if (!isSupabaseConfigured()) {
    console.warn("[storefront] Supabase env is missing. Returning no products.");
    return [] as StorefrontProduct[];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("*");

  if (error) {
    console.error("[storefront] Failed to fetch visible products from Supabase.", error);
    return [] as StorefrontProduct[];
  }

  const mapped = (data ?? [])
    .map((row) => mapSupabaseRowToProduct(row as JsonRecord))
    .filter((product) => isStorefrontSellableProduct(product))
    .map(mapProductToStorefrontProduct);

  console.debug("[storefront] Visible products loaded.", {
    count: mapped.length,
  });

  return mapped;
}

export async function getVisibleStorefrontProductById(id: string) {
  if (!isSupabaseConfigured()) {
    console.warn("[storefront] Supabase env is missing. Unable to resolve product.", {
      id,
    });
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[storefront] Failed to fetch product from Supabase.", {
      id,
      error,
    });
    return null;
  }

  if (!data) {
    console.debug("[storefront] Product not found or hidden.", { id });
    return null;
  }

  const adminProduct = mapSupabaseRowToProduct(data as JsonRecord);

  if (!isStorefrontSellableProduct(adminProduct)) {
    console.debug("[storefront] Product is out of stock and hidden.", { id });
    return null;
  }

  const product = mapProductToStorefrontProduct(adminProduct);

  console.debug("[storefront] Product details loaded.", {
    id: product.id,
    name: product.name,
  });

  return product;
}


