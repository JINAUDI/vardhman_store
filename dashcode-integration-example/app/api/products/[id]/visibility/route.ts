import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseConfigSummary, isSupabaseConfigured } from "@/lib/supabase/config";
import { mapSupabaseRowToProduct } from "@/lib/supabase/products";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type ProductRow = Record<string, unknown>;

function readCurrentVisibility(row: ProductRow) {
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
  if (["draft", "archived", "inactive", "hidden", "out_of_stock", "unpublished", "disabled", "deleted"].includes(status)) return false;
  if (booleanFlags.some((value) => value === true)) return true;
  return true;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function isOutOfStock(row: ProductRow) {
  const trackInventory = row.track_inventory !== false && row.trackInventory !== false;
  const allowBackorder = row.allow_backorder === true || row.allowBackorder === true;
  if (!trackInventory || allowBackorder) return false;

  const stock = readNumber(row.stock ?? row.quantity ?? row.inventory_quantity ?? row.inventoryQuantity, 0);
  const reservedStock = readNumber(row.reserved_stock ?? row.reservedStock, 0);
  const availableStock =
    row.available_stock !== undefined || row.availableStock !== undefined
      ? readNumber(row.available_stock ?? row.availableStock, Math.max(stock - reservedStock, 0))
      : Math.max(stock - reservedStock, 0);

  return availableStock <= 0;
}

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42703" || /column .* does not exist/i.test(maybeError.message || "");
}

async function updateVisibility(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  visible: boolean
) {
  const status = visible ? "active" : "hidden";
  const payloads: ProductRow[] = [
    { visible, is_active: visible, status },
    { visible, status },
    { visible, is_active: visible },
    { visible },
  ];
  let lastError: unknown = null;

  for (const payload of payloads) {
    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (!error) return data;
    lastError = error;
    if (!isMissingColumnError(error)) throw error;
  }

  throw lastError;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        status: "fail",
        message: "Supabase environment variables are missing.",
        data: getSupabaseConfigSummary(),
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const supabase = createSupabaseAdminClient();
    const { data: current, error: currentError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (currentError) {
      throw currentError;
    }

    const nextVisible =
      typeof body.visible === "boolean"
        ? body.visible
        : !readCurrentVisibility(current as ProductRow);

    if (nextVisible && isOutOfStock(current as ProductRow)) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Restock this product before showing it on the storefront.",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const data = await updateVisibility(supabase, id, nextVisible);
    const product = mapSupabaseRowToProduct(data as Record<string, unknown>);

    console.debug("[admin] Product visibility updated in Supabase.", {
      id: product.id,
      requestedVisible: nextVisible,
      visible: product.visible,
      status: product.status,
    });

    return NextResponse.json(
      {
        status: "success",
        message: "Product visibility updated successfully",
        data: product,
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[admin] Failed to update product visibility in Supabase.", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to update product visibility in Supabase.",
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
