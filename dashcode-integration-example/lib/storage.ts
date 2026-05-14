"use client";

import type { Product } from "./api";
import { getCurrentAdmin, getSupabaseBrowserClient } from "./admin-auth";

export const STOREFRONT_IMAGE_BUCKETS = {
  products: "product-images",
  banners: "banner-images",
  categories: "category-images"
} as const;

export type StorefrontImageBucket = typeof STOREFRONT_IMAGE_BUCKETS[keyof typeof STOREFRONT_IMAGE_BUCKETS];

export type UploadedStorefrontImage = {
  bucket: StorefrontImageBucket;
  path: string;
  url: string;
};

type UploadOptions = {
  folder?: string;
  slug?: string;
  oldUrl?: string | null;
  deleteOld?: boolean;
};

export type ProductImageFields = Pick<Product, "image" | "image_url" | "images">;

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function slugify(value: string | undefined) {
  return String(value || "image")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
}

function extensionForType(type: string, fallbackName: string) {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";

  const match = fallbackName.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "jpg";
}

function validateImageFile(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Please upload a JPG, PNG, or WebP image.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be 3MB or smaller.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function compressImageIfHelpful(file: File) {
  validateImageFile(file);

  if (file.type === "image/webp" || file.size < 1.5 * 1024 * 1024 || typeof window === "undefined") {
    return { blob: file, contentType: file.type, extension: extensionForType(file.type, file.name) };
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return { blob: file, contentType: file.type, extension: extensionForType(file.type, file.name) };
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const webpBlob = await canvasToBlob(canvas, "image/webp", 0.82);
  if (webpBlob && webpBlob.size < file.size) {
    return { blob: webpBlob, contentType: "image/webp", extension: "webp" };
  }

  return { blob: file, contentType: file.type, extension: extensionForType(file.type, file.name) };
}

function buildStoragePath(file: File, preparedExtension: string, options: UploadOptions) {
  const folder = slugify(options.folder || "uploads");
  const slug = slugify(options.slug || file.name.replace(/\.[^.]+$/g, ""));
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${folder}/${unique}-${slug}.${preparedExtension}`;
}

function parseManagedStorageUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) return null;

  try {
    const parsed = new URL(publicUrl);
    const marker = "/storage/v1/object/public/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const storagePath = parsed.pathname.slice(markerIndex + marker.length);
    const [bucket, ...rest] = storagePath.split("/");
    if (!Object.values(STOREFRONT_IMAGE_BUCKETS).includes(bucket as StorefrontImageBucket)) return null;

    return {
      bucket: bucket as StorefrontImageBucket,
      path: decodeURIComponent(rest.join("/"))
    };
  } catch {
    return null;
  }
}

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function deleteStorefrontImage(publicUrl: string | null | undefined) {
  const parsed = parseManagedStorageUrl(publicUrl);
  if (!parsed) return;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) {
    throw error;
  }
}

export async function uploadStorefrontImage(bucket: StorefrontImageBucket, file: File, options: UploadOptions = {}): Promise<UploadedStorefrontImage> {
  await getCurrentAdmin();

  const supabase = getSupabaseBrowserClient();
  const prepared = await compressImageIfHelpful(file);
  const path = buildStoragePath(file, prepared.extension, options);

  const { error } = await supabase.storage.from(bucket).upload(path, prepared.blob, {
    cacheControl: "31536000",
    contentType: prepared.contentType,
    upsert: false
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const uploaded = { bucket, path, url: data.publicUrl };

  if (options.deleteOld && options.oldUrl && options.oldUrl !== uploaded.url) {
    await deleteStorefrontImage(options.oldUrl);
  }

  return uploaded;
}

export function uploadProductImage(file: File, options: UploadOptions = {}) {
  return uploadStorefrontImage(STOREFRONT_IMAGE_BUCKETS.products, file, options);
}

export function uploadProductGallery(files: File[], options: UploadOptions = {}) {
  return Promise.all(files.map((file) => uploadProductImage(file, options)));
}

export function uploadBannerImage(file: File, options: UploadOptions = {}) {
  return uploadStorefrontImage(STOREFRONT_IMAGE_BUCKETS.banners, file, options);
}

export function uploadCategoryImage(file: File, options: UploadOptions = {}) {
  return uploadStorefrontImage(STOREFRONT_IMAGE_BUCKETS.categories, file, options);
}

export async function saveSupabaseProductImages(product: Product, payload: ProductImageFields) {
  await getCurrentAdmin();

  const supabase = getSupabaseBrowserClient();
  const productId = [product.id, product._id].find((value) => isUuid(value));
  let query = supabase.from("products").update(payload);

  if (productId) {
    query = query.eq("id", productId);
  } else if (product.slug) {
    query = query.eq("slug", product.slug);
  } else {
    throw new Error("Product image uploaded, but this product has no Supabase id or slug to save against.");
  }

  const { data, error } = await query.select("id").limit(1);
  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("Product image uploaded, but no matching Supabase product row was found.");
  }

  return data[0];
}
