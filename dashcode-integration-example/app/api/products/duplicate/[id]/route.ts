import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseConfigSummary, isSupabaseConfigured } from "@/lib/supabase/config";
import { mapSupabaseRowToProduct } from "@/lib/supabase/products";

function duplicateSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(
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
    const { data: original, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const base = original as Record<string, unknown>;
    const suffix = duplicateSuffix();
    const stock = typeof base.stock === "number" ? base.stock : Number(base.stock ?? 0);
    const status =
      base.status === "draft" ||
      base.status === "hidden" ||
      base.status === "out_of_stock" ||
      base.status === "archived" ||
      base.status === "active"
        ? base.status
        : stock <= 0
          ? "out_of_stock"
          : "active";
    const visible =
      status === "active" &&
      (typeof base.visible === "boolean"
        ? base.visible
        : typeof base.isVisible === "boolean"
          ? base.isVisible
          : true);
    const duplicatePayload = {
      name: `${String(base.name ?? "Product")} Copy`,
      description: typeof base.description === "string" ? base.description : "",
      price: typeof base.price === "number" ? base.price : Number(base.price ?? 0),
      compare_at_price:
        typeof base.compare_at_price === "number"
          ? base.compare_at_price
          : base.compareAtPrice ?? null,
      sku: `${String(base.sku ?? "SKU")}-COPY-${suffix.slice(-4).toUpperCase()}`,
      stock,
      category: String(base.category ?? "General"),
      image:
        typeof base.image === "string" && base.image
          ? base.image
          : "/images/all-img/p-1.png",
      visible,
      featured: false,
      status,
      low_stock_threshold:
        typeof base.low_stock_threshold === "number"
          ? base.low_stock_threshold
          : base.lowStockThreshold ?? 10,
    };

    const { data, error } = await supabase
      .from("products")
      .insert(duplicatePayload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const product = mapSupabaseRowToProduct(data as Record<string, unknown>);

    console.debug("[admin] Product duplicated in Supabase.", {
      sourceId: id,
      duplicateId: product.id,
    });

    return NextResponse.json({
      status: "success",
      message: "Product duplicated successfully",
      data: product,
      storage: "supabase",
    });
  } catch (error) {
    console.error("[admin] Failed to duplicate product in Supabase.", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to duplicate product in Supabase.",
        data: error instanceof Error ? error.message : error,
      },
      { status: 400 }
    );
  }
}
