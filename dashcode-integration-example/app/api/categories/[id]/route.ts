import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfigSummary, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import { mapCategoryToSupabasePayload, mapSupabaseRowToCategory } from "@/lib/supabase/catalog";
import type { Category } from "@/lib/store/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: "Supabase environment variables are missing.", data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<Category>;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("categories")
      .update(mapCategoryToSupabasePayload(body))
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        status: "success",
        message: "Category updated successfully",
        data: mapSupabaseRowToCategory(data as Record<string, unknown>),
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to update category in Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: "Supabase environment variables are missing.", data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { id } = await context.params;
    const force = request.nextUrl.searchParams.get("force") === "true";
    const supabase = createSupabaseAdminClient();
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("name")
      .eq("id", id)
      .maybeSingle();

    if (categoryError) throw categoryError;
    if (!category) {
      return NextResponse.json({ status: "fail", message: "Category not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const { count, error: countError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category", category.name);

    if (countError) throw countError;

    if ((count ?? 0) > 0 && !force) {
      return NextResponse.json(
        {
          status: "blocked",
          message: `This category is linked to ${count} product${count === 1 ? "" : "s"}. Confirm deletion to keep those products unchanged and remove the category.`,
          data: { linkedProducts: count },
        },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json(
      { status: "success", message: "Category deleted successfully", data: { deleted: true, id }, storage: "supabase" },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to delete category from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
