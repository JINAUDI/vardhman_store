import type { Product } from "@/lib/store/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type JsonRecord = Record<string, unknown>;

type InventoryAlertInput = {
  id: string;
  name: string;
  stock: number;
  reservedStock?: number;
  availableStock?: number;
  lowStockThreshold: number;
  trackInventory?: boolean;
  allowBackorder?: boolean;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
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

function getAvailableStock(product: InventoryAlertInput) {
  return typeof product.availableStock === "number"
    ? product.availableStock
    : Math.max(product.stock - (product.reservedStock || 0), 0);
}

function getInventoryAlertState(product: InventoryAlertInput) {
  if (product.trackInventory === false) return "not_tracked";
  const availableStock = getAvailableStock(product);
  if (availableStock <= 0 && product.allowBackorder !== true) return "out_of_stock";
  if (availableStock <= product.lowStockThreshold) return "low_stock";
  return "in_stock";
}

function mapRowToInventoryAlertInput(row: JsonRecord): InventoryAlertInput {
  const stock = readNumber(row.stock ?? row.quantity ?? row.inventory_quantity ?? row.inventoryQuantity, 0);
  const reservedStock = readNumber(row.reserved_stock ?? row.reservedStock, 0);

  return {
    id: readString(row.id),
    name: readString(row.name ?? row.title, "Product"),
    stock,
    reservedStock,
    availableStock: readNumber(row.available_stock ?? row.availableStock, Math.max(stock - reservedStock, 0)),
    lowStockThreshold: readNumber(row.low_stock_threshold ?? row.lowStockThreshold, 10),
    trackInventory: readBoolean(row.track_inventory ?? row.trackInventory, true),
    allowBackorder: readBoolean(row.allow_backorder ?? row.allowBackorder, false),
  };
}

export function isStorefrontSellableProduct(product: Pick<Product, "stock" | "availableStock" | "trackInventory" | "allowBackorder">) {
  if (product.trackInventory === false || product.allowBackorder === true) return true;
  const availableStock =
    typeof product.availableStock === "number" ? product.availableStock : Math.max(product.stock, 0);
  return availableStock > 0;
}

export async function createInventoryAlertNotification(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  previousProduct: Product | JsonRecord | null | undefined,
  nextProduct: Product | JsonRecord
) {
  const next =
    "lowStockThreshold" in nextProduct
      ? (nextProduct as InventoryAlertInput)
      : mapRowToInventoryAlertInput(nextProduct as JsonRecord);
  const previous = previousProduct
    ? "lowStockThreshold" in previousProduct
      ? (previousProduct as InventoryAlertInput)
      : mapRowToInventoryAlertInput(previousProduct as JsonRecord)
    : null;

  const previousState = previous ? getInventoryAlertState(previous) : "in_stock";
  const nextState = getInventoryAlertState(next);

  if (nextState !== "low_stock" && nextState !== "out_of_stock") return;
  if (previousState === nextState || previousState === "out_of_stock") return;

  const availableStock = getAvailableStock(next);
  const title = nextState === "out_of_stock" ? "Product Out of Stock" : "Low Stock Alert";
  const message =
    nextState === "out_of_stock"
      ? `${next.name} is out of stock and hidden from the storefront.`
      : `${next.name} has ${availableStock} left. Threshold is ${next.lowStockThreshold}.`;
  const basePayload = {
    type: "stock",
    title,
    message,
    is_read: false,
  };
  const stockPayload = {
    ...basePayload,
    product_id: next.id,
    product_name: next.name,
    current_stock: availableStock,
    threshold: next.lowStockThreshold,
  };

  const { error } = await supabase.from("notifications").insert(stockPayload);
  if (!error) return;

  const maybeMissingColumn =
    error.code === "42703" || /column .* does not exist/i.test(error.message || "");

  if (maybeMissingColumn) {
    const fallback = await supabase.from("notifications").insert(basePayload);
    if (fallback.error) {
      console.warn("[inventory-alerts] Unable to create fallback stock notification.", fallback.error);
    }
    return;
  }

  console.warn("[inventory-alerts] Unable to create stock notification.", error);
}
