import path from "path";
import type { Product } from "@/lib/store/types";
import { readJsonStore, writeJsonStore } from "@/lib/server/json-store";
import { createSeedProducts } from "@/lib/server/product-seed";

const PRODUCTS_PATH = path.join(process.cwd(), "data", "products.json");

function createServerId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStoredProduct(product: Product): Product {
  const rawVisible =
    typeof product.isVisible === "boolean"
      ? product.isVisible
      : product.visible !== false;
  const status =
    product.stock <= 0 && product.allowBackorder !== true
      ? "out_of_stock"
      : product.status === "hidden" ||
          product.status === "out_of_stock" ||
          product.status === "draft" ||
          product.status === "archived" ||
          product.status === "active"
        ? product.status
        : "active";
  const visible = status === "active" && rawVisible;

  return {
    ...product,
    status,
    visible,
    isVisible: visible,
  };
}

async function saveProducts(products: Product[]) {
  return writeJsonStore(PRODUCTS_PATH, products);
}

export async function getStoredProducts(): Promise<Product[]> {
  const products = await readJsonStore(PRODUCTS_PATH, createSeedProducts());
  const normalized = products.map(normalizeStoredProduct);

  if (JSON.stringify(products) !== JSON.stringify(normalized)) {
    await saveProducts(normalized);
  }

  return normalized;
}

export async function createStoredProduct(
  product: Omit<Product, "id" | "createdAt" | "updatedAt">
) {
  const products = await getStoredProducts();
  const now = new Date().toISOString();
  const nextProduct = normalizeStoredProduct({
    ...product,
    id: createServerId("prod"),
    createdAt: now,
    updatedAt: now,
  });

  await saveProducts([nextProduct, ...products]);
  return nextProduct;
}

export async function updateStoredProduct(
  productId: string,
  updates: Partial<Product>
) {
  const products = await getStoredProducts();
  const next = products.map((product) =>
    product.id === productId
      ? normalizeStoredProduct({
          ...product,
          ...updates,
          updatedAt: new Date().toISOString(),
        })
      : product
  );
  await saveProducts(next);
  return next.find((product) => product.id === productId) || null;
}

export async function deleteStoredProduct(productId: string) {
  const products = await getStoredProducts();
  const next = products.filter((product) => product.id !== productId);
  await saveProducts(next);
  return { deleted: products.length !== next.length };
}

export async function duplicateStoredProduct(productId: string) {
  const products = await getStoredProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) return null;

  const now = new Date().toISOString();
  const duplicateId = createServerId("prod");
  const duplicate: Product = normalizeStoredProduct({
    ...product,
    id: duplicateId,
    name: `${product.name} Copy`,
    slug: `${product.slug}-copy-${duplicateId.slice(-4)}`,
    sku: `${product.sku}-COPY`,
    featured: false,
    createdAt: now,
    updatedAt: now,
  });

  await saveProducts([duplicate, ...products]);
  return duplicate;
}

export async function toggleStoredProductVisibility(productId: string) {
  const products = await getStoredProducts();
  let updated: Product | null = null;

  const next = products.map((product) => {
    if (product.id !== productId) return product;

    updated = normalizeStoredProduct({
      ...product,
      visible: product.visible === false,
      status: product.visible === false ? "active" : "hidden",
      updatedAt: new Date().toISOString(),
    });
    return updated;
  });

  await saveProducts(next);
  return updated;
}

export async function bulkDeleteStoredProducts(productIds: string[]) {
  const idSet = new Set(productIds);
  const products = await getStoredProducts();
  const next = products.filter((product) => !idSet.has(product.id));
  await saveProducts(next);
  return {
    deletedCount: products.length - next.length,
  };
}
