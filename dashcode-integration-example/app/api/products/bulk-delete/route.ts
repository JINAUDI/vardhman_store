import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseConfigSummary, isSupabaseConfigured } from "@/lib/supabase/config";

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function DELETE(request: NextRequest) {
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
    const body = await request.json();
    const payload = bulkDeleteSchema.parse(body);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("products").delete().in("id", payload.ids);

    if (error) {
      throw error;
    }

    console.debug("[admin] Products bulk deleted from Supabase.", {
      count: payload.ids.length,
    });

    return NextResponse.json({
      status: "success",
      message: "Products deleted successfully",
      data: {
        deletedCount: payload.ids.length,
        ids: payload.ids,
      },
      storage: "supabase",
    });
  } catch (error) {
    console.error("[admin] Failed to bulk delete products from Supabase.", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to delete selected products from Supabase.",
        data: error instanceof Error ? error.message : error,
      },
      { status: 400 }
    );
  }
}
