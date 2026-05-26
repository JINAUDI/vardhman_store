import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import {
  mapDraftToSupabaseInsert,
  mapSupabaseRowToProduct,
} from "@/lib/supabase/products";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import type { ProductDraft } from "@/lib/store/types";

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

async function insertProductWithSchemaFallback(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: JsonRecord
) {
  const nextPayload = { ...payload };

  for (let attempt = 0; attempt < optionalProductColumns.size + 1; attempt += 1) {
    const { data, error } = await supabase
      .from("products")
      .insert(nextPayload)
      .select("*")
      .single();

    if (!error) return data;

    const missingColumn = getMissingColumnName(error);
    if (!missingColumn || !optionalProductColumns.has(missingColumn)) {
      throw error;
    }

    delete nextPayload[missingColumn];
  }

  throw new Error("Unable to insert product with the current products schema.");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        status: "fail",
        message: getSupabaseSetupMessage(),
        data: getSupabaseConfigSummary(),
      },
      { status: 500 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").select("*");

    if (error) {
      throw error;
    }

    const products = (data ?? []).map((row) =>
      mapSupabaseRowToProduct(row as Record<string, unknown>)
    );

    console.debug("[admin] Products loaded from Supabase.", {
      count: products.length,
    });

    return NextResponse.json({
      status: "success",
      message: "Products fetched successfully",
      data: products,
      storage: "supabase",
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[admin] Failed to fetch products from Supabase.", error);

    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(
          error,
          "Unable to fetch products from Supabase."
        ),
        data: error,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        status: "fail",
        message: getSupabaseSetupMessage(),
        data: getSupabaseConfigSummary(),
      },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as Partial<ProductDraft>;
    const payload = mapDraftToSupabaseInsert({
      images: Array.isArray(body.images) ? body.images : [],
      category: body.category ?? "General",
      subcategory: body.subcategory,
      name: body.name ?? "",
      description: body.description ?? "",
      tags: Array.isArray(body.tags) ? body.tags : [],
      attributes: body.attributes ?? {},
      variants: Array.isArray(body.variants) ? body.variants : [],
      hasPersonalization: Boolean(body.hasPersonalization),
      personalizationInstructions: body.personalizationInstructions,
      price: typeof body.price === "number" ? body.price : 0,
      compareAtPrice:
        typeof body.compareAtPrice === "number" ? body.compareAtPrice : undefined,
      costPerItem:
        typeof body.costPerItem === "number" ? body.costPerItem : undefined,
      sku: body.sku ?? "",
      barcode: body.barcode,
      quantity: typeof body.quantity === "number" ? body.quantity : 0,
      lowStockThreshold:
        typeof body.lowStockThreshold === "number" ? body.lowStockThreshold : 10,
      regionalPricing: body.regionalPricing,
      processingTime: body.processingTime ?? "",
      freeShipping: Boolean(body.freeShipping),
      flatRateShipping:
        typeof body.flatRateShipping === "number" ? body.flatRateShipping : undefined,
      standardShipping:
        typeof body.standardShipping === "number" ? body.standardShipping : undefined,
      expressShipping:
        typeof body.expressShipping === "number" ? body.expressShipping : undefined,
      returnPolicy: body.returnPolicy ?? "30_days",
      customReturnPolicy: body.customReturnPolicy,
      status: body.status ?? "published",
      featured: Boolean(body.featured),
      metaTitle: body.metaTitle,
      metaDescription: body.metaDescription,
      createdAt: body.createdAt ?? new Date().toISOString(),
      updatedAt: body.updatedAt ?? new Date().toISOString(),
    });

    const supabase = createSupabaseAdminClient();
    const data = await insertProductWithSchemaFallback(supabase, payload);

    const product = mapSupabaseRowToProduct(data as Record<string, unknown>);

    console.debug("[admin] Product inserted into Supabase.", {
      id: product.id,
      sku: product.sku,
    });

    return NextResponse.json({
      status: "success",
      message: "Product created successfully",
      data: product,
      storage: "supabase",
    });
  } catch (error) {
    console.error("[admin] Failed to create product in Supabase.", error);

    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(
          error,
          "Unable to create product in Supabase."
        ),
        data: error,
      },
      { status: 400 }
    );
  }
}
