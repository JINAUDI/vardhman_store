import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfigSummary, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import {
  mapDiscountToSupabasePayload,
  mapSupabaseRowToDiscount,
} from "@/lib/supabase/marketing";
import type { Coupon } from "@/lib/store/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const REQUIRED_DISCOUNT_COLUMNS = new Set([
  "discount_category",
  "buy_quantity",
  "get_quantity",
]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function getMissingColumnName(error: unknown) {
  var message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  var match = message.match(/Could not find the '([^']+)' column of 'discounts'/i);
  return match ? match[1] : null;
}

function isCodeRequiredError(error: unknown) {
  var message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  return /null value in column "code"/i.test(message);
}

function withInternalAutomaticCode(payload: Record<string, unknown>) {
  if (payload.method !== "automatic" || payload.code) {
    return payload;
  }

  return {
    ...payload,
    code: `AUTO-${Date.now().toString(36).toUpperCase()}`,
  };
}

async function updateDiscountWithSchemaFallback(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  payload: Record<string, unknown>
) {
  let nextPayload = { ...payload };

  for (;;) {
    const result = await supabase
      .from("discounts")
      .update(nextPayload)
      .eq("id", id)
      .select("*")
      .single();

    if (!result.error) {
      return result;
    }

    if (isCodeRequiredError(result.error) && nextPayload.method === "automatic" && !nextPayload.code) {
      nextPayload = withInternalAutomaticCode(nextPayload);
      continue;
    }

    const missingColumn = getMissingColumnName(result.error);
    if (
      !missingColumn ||
      REQUIRED_DISCOUNT_COLUMNS.has(missingColumn) ||
      !(missingColumn in nextPayload)
    ) {
      return result;
    }

    delete nextPayload[missingColumn];
  }
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
    const body = (await request.json()) as Partial<Coupon>;
    const supabase = createSupabaseAdminClient();
    const { data: existingData, error: existingError } = await supabase
      .from("discounts")
      .select("*")
      .eq("id", id)
      .single();

    if (existingError) throw existingError;

    const existingDiscount = mapSupabaseRowToDiscount(existingData as Record<string, unknown>);
    const { data, error } = await updateDiscountWithSchemaFallback(
      supabase,
      id,
      mapDiscountToSupabasePayload({
        ...existingDiscount,
        ...body,
        usedCount: existingDiscount.usedCount,
      }) as Record<string, unknown>
    );

    if (error) throw error;

    return NextResponse.json(
      {
        status: "success",
        message: "Discount updated successfully",
        data: mapSupabaseRowToDiscount(data as Record<string, unknown>),
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(
          error,
          "Unable to update discount in Supabase."
        ),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json(
      { status: "success", message: "Discount deleted successfully", data: { deleted: true, id }, storage: "supabase" },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(
          error,
          "Unable to delete discount from Supabase."
        ),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
