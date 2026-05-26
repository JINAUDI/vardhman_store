import type { Category, HomepageBanner } from "@/lib/store/types";

type JsonRecord = Record<string, unknown>;

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function readIsoDate(value: unknown, fallback = new Date().toISOString()) {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

export function slugifyCatalogValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function mapSupabaseRowToCategory(row: JsonRecord): Category {
  const name = readString(row.name, "Untitled Category");

  return {
    id: readString(row.id),
    name,
    slug: readString(row.slug, slugifyCatalogValue(name)),
    icon: readOptionalString(row.icon),
    description: readOptionalString(row.description),
    isActive: readBoolean(row.is_active ?? row.isActive, true),
    sortOrder: readNumber(row.sort_order ?? row.sortOrder, 0),
    createdAt: readIsoDate(row.created_at ?? row.createdAt),
  };
}

export function mapCategoryToSupabasePayload(category: Partial<Category>) {
  const name = category.name?.trim() ?? "";

  return {
    name,
    slug: (category.slug?.trim() || slugifyCatalogValue(name)),
    icon: category.icon?.trim() || null,
    description: category.description?.trim() || null,
    is_active: category.isActive ?? true,
    sort_order: category.sortOrder ?? 0,
  };
}

export function mapSupabaseRowToHomepageBanner(row: JsonRecord): HomepageBanner {
  return {
    id: readString(row.id),
    title: readString(row.title, "Untitled Banner"),
    subtitle: readOptionalString(row.subtitle),
    buttonText: readString(row.button_text ?? row.buttonText, "Shop Now"),
    buttonLink: readOptionalString(row.button_link ?? row.buttonLink),
    imageUrl: readString(row.image_url ?? row.imageUrl),
    categoryId: readOptionalString(row.category_id ?? row.categoryId),
    sectionKey: readString(row.section_key ?? row.sectionKey ?? row.banner_type ?? row.bannerType, "hero"),
    bannerType: readString(row.banner_type ?? row.bannerType, "hero"),
    isActive: readBoolean(row.is_active ?? row.isActive, true),
    sortOrder: readNumber(row.sort_order ?? row.sortOrder, 0),
    createdAt: readIsoDate(row.created_at ?? row.createdAt),
  };
}

export function mapHomepageBannerToSupabasePayload(banner: Partial<HomepageBanner>) {
  return {
    title: banner.title?.trim() ?? "",
    subtitle: banner.subtitle?.trim() || null,
    button_text: banner.buttonText?.trim() || "Shop Now",
    button_link: banner.buttonLink?.trim() || null,
    image_url: banner.imageUrl?.trim() ?? "",
    category_id: banner.categoryId || null,
    section_key: banner.sectionKey?.trim() || banner.bannerType?.trim() || "hero",
    banner_type: banner.bannerType?.trim() || banner.sectionKey?.trim() || "hero",
    is_active: banner.isActive ?? true,
    sort_order: banner.sortOrder ?? 0,
  };
}
