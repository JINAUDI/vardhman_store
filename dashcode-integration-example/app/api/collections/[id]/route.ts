import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfigSummary, isSupabaseConfigured } from "@/lib/supabase/config";
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
    const body = (await request.json()) as Partial<Collection>;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("collections")
      .update(mapCollectionToSupabasePayload(body))
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        status: "success",
        message: "Collection updated successfully",
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
          "Unable to update collection in Supabase."
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
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json(
      { status: "success", message: "Collection deleted successfully", data: { deleted: true, id }, storage: "supabase" },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(
          error,
          "Unable to delete collection from Supabase."
        ),
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
