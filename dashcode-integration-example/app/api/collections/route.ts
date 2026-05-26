import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import {
  mapCollectionToSupabasePayload,
  mapSupabaseRowToCollection,
} from "@/lib/supabase/marketing";
import type { Collection } from "@/lib/store/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
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
    const slug = request.nextUrl.searchParams.get("slug");
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("collections")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (activeOnly) query = query.eq("is_active", true);
    if (slug) query = query.eq("slug", slug);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      {
        status: "success",
        message: "Collections fetched successfully",
        data: (data ?? []).map((row) =>
          mapSupabaseRowToCollection(row as Record<string, unknown>)
        ),
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
          "Unable to fetch collections from Supabase."
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
    const body = (await request.json()) as Partial<Collection>;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("collections")
      .insert(mapCollectionToSupabasePayload(body))
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        status: "success",
        message: "Collection created successfully",
        data: mapSupabaseRowToCollection(data as Record<string, unknown>),
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
          "Unable to create collection in Supabase."
        ),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
