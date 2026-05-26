import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseConfigSummary, isSupabaseConfigured } from "@/lib/supabase/config";
import {
  mapProductUpdateToSupabaseUpdate,
  mapSupabaseRowToProduct,
} from "@/lib/supabase/products";
import { createInventoryAlertNotification } from "@/lib/supabase/inventory-alerts";
import type { Product } from "@/lib/store/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JsonRecord = Record<string, unknown>;

const optionalProductColumns = new Set([
  "is_active",
  "inventory_status",
  "reserved_stock",
  "low_stock_threshold",
  "track_inventory",
  "allow_backorder",
  "compare_at_price",
  "meta_description",
  "meta_title",
]);

function getMissingColumnName(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";

  return (
    message.match(/Could not find the '([^']+)' column of 'products'/i)?.[1] ||
    message.match(/column products\.([^\s]+) does not exist/i)?.[1] ||
    message.match(/column "?([^"\s]+)"? of relation "products" does not exist/i)?.[1] ||
    null
  );
}

async function updateProductWithSchemaFallback(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  updates: JsonRecord
) {
  const nextUpdates = { ...updates };

  for (let attempt = 0; attempt < optionalProductColumns.size + 1; attempt += 1) {
    const { data, error } = await supabase
      .from("products")
      .update(nextUpdates)
      .eq("id", id)
      .select("*")
      .single();

    if (!error) return data;

    const missingColumn = getMissingColumnName(error);
    if (!missingColumn || !optionalProductColumns.has(missingColumn)) {
      throw error;
    }

    delete nextUpdates[missingColumn];
  }

  throw new Error("Unable to update product with the current products schema.");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
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
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Product not found",
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const product = mapSupabaseRowToProduct(data as Record<string, unknown>);

    console.debug("[admin] Product loaded from Supabase.", {
      id: product.id,
      name: product.name,
    });

    return NextResponse.json(
      {
        status: "success",
        message: "Product fetched successfully",
        data: product,
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[admin] Failed to fetch product from Supabase.", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to fetch product from Supabase.",
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
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
      { status: 500 }
    );
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<Product>;
    const updates = mapProductUpdateToSupabaseUpdate(body);
    const supabase = createSupabaseAdminClient();
    const { data: previousRow, error: previousError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (previousError) {
      throw previousError;
    }

    const previousProduct = mapSupabaseRowToProduct(previousRow as Record<string, unknown>);
    const nextStock =
      typeof body.stock === "number" ? body.stock : previousProduct.stock;
    const nextTrackInventory =
      typeof body.trackInventory === "boolean" ? body.trackInventory : previousProduct.trackInventory !== false;
    const nextAllowBackorder =
      typeof body.allowBackorder === "boolean" ? body.allowBackorder : previousProduct.allowBackorder === true;

    if (nextTrackInventory && !nextAllowBackorder && nextStock <= 0) {
      updates.visible = false;
      updates.is_active = false;
      updates.status = "out_of_stock";
      updates.inventory_status = "out_of_stock";
    } else if (body.status === "active" || body.visible === true || body.isVisible === true) {
      updates.visible = true;
      updates.is_active = true;
      updates.status = "active";
    }

    const data = await updateProductWithSchemaFallback(supabase, id, updates);

    const product = mapSupabaseRowToProduct(data as Record<string, unknown>);
    await createInventoryAlertNotification(supabase, previousProduct, product);

    console.debug("[admin] Product updated in Supabase.", {
      id: product.id,
      sku: product.sku,
    });

    return NextResponse.json({
      status: "success",
      message: "Product updated successfully",
      data: product,
      storage: "supabase",
    });
  } catch (error) {
    console.error("[admin] Failed to update product in Supabase.", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to update product in Supabase.",
        data: error instanceof Error ? error.message : error,
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        status: "fail",
        message: "Supabase environment variables are missing.",
        data: getSupabaseConfigSummary(),
      },
      { status: 500 }
    );
  }

  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      throw error;
    }

    console.debug("[admin] Product deleted from Supabase.", { id });

    return NextResponse.json({
      status: "success",
      message: "Product deleted successfully",
      data: { deleted: true, id },
      storage: "supabase",
    });
  } catch (error) {
    console.error("[admin] Failed to delete product from Supabase.", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to delete product from Supabase.",
        data: error instanceof Error ? error.message : error,
      },
      { status: 400 }
    );
  }
}
