import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import {
  mapDiscountToSupabasePayload,
  mapSupabaseRowToDiscount,
} from "@/lib/supabase/marketing";
import { getComputedCouponStatus } from "@/lib/store/coupon-status";
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

async function insertDiscountWithSchemaFallback(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>
) {
  let nextPayload = { ...payload };

  for (;;) {
    const result = await supabase.from("discounts").insert(nextPayload).select("*").single();
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

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const activeOnly = request.nextUrl.searchParams.get("active") === "true";
    const method = request.nextUrl.searchParams.get("method");
    const category = request.nextUrl.searchParams.get("category");
    const code = request.nextUrl.searchParams.get("code");
    const supabase = createSupabaseAdminClient();
    const buildQuery = (withStatusFilter: boolean) => {
      let nextQuery = supabase
        .from("discounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (activeOnly && withStatusFilter) nextQuery = nextQuery.eq("status", "active");
      if (method) nextQuery = nextQuery.eq("method", method);
      if (category) nextQuery = nextQuery.eq("discount_category", category);
      if (code) nextQuery = nextQuery.eq("code", code.toUpperCase());

      return nextQuery;
    };

    let { data, error } = await buildQuery(true);
    const missingStatus =
      error &&
      typeof error === "object" &&
      "message" in error &&
      /column discounts\.status does not exist/i.test(String(error.message));

    if (missingStatus) {
      const fallback = await buildQuery(false);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const discounts = (data ?? [])
      .map((row) => mapSupabaseRowToDiscount(row as Record<string, unknown>))
      .filter((discount) => !activeOnly || getComputedCouponStatus(discount) === "active");

    return NextResponse.json(
      {
        status: "success",
        message: "Discounts fetched successfully",
        data: discounts,
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
          "Unable to fetch discounts from Supabase."
        ),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const body = (await request.json()) as Partial<Coupon>;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await insertDiscountWithSchemaFallback(
      supabase,
      mapDiscountToSupabasePayload(body) as Record<string, unknown>
    );

    if (error) throw error;

    return NextResponse.json(
      {
        status: "success",
        message: "Discount created successfully",
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
          "Unable to create discount in Supabase."
        ),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
