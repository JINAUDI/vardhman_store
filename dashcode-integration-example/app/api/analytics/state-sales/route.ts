import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import {
  INDIA_STATES,
  type IndiaStateSalesItem,
  normalizeIndianState,
} from "@/lib/analytics/india-state-sales";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const IGNORED_ORDER_STATUSES = new Set(["cancelled", "canceled", "failed", "refunded"]);

type OrderSalesRow = {
  id?: string | null;
  state?: string | null;
  city?: string | null;
  total?: number | string | null;
  status?: string | null;
  order_status?: string | null;
  created_at?: string | null;
};

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getMonthBounds(now = new Date()) {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return {
    currentMonthStart,
    previousMonthStart,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "fail", message: getSupabaseSetupMessage(), data: getSupabaseConfigSummary() },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select("id,state,city,total,status,order_status,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as OrderSalesRow[];
    const { currentMonthStart, previousMonthStart } = getMonthBounds();
    const totalsByState = new Map<string, IndiaStateSalesItem>(
      INDIA_STATES.map((state) => [
        state.code,
        {
          ...state,
          total: 0,
          orderCount: 0,
          percentage: 0,
        },
      ])
    );

    let totalRevenue = 0;
    let currentMonthRevenue = 0;
    let previousMonthRevenue = 0;
    let orderCount = 0;
    let unknownOrderCount = 0;

    for (const row of rows) {
      const status = readString(row.order_status ?? row.status).toLowerCase();
      if (IGNORED_ORDER_STATUSES.has(status)) continue;

      const total = Math.max(0, readNumber(row.total));
      if (!total) continue;

      const orderDate = row.created_at ? new Date(row.created_at) : null;
      const state = normalizeIndianState(row.state, row.city);

      totalRevenue += total;
      orderCount += 1;

      if (orderDate && !Number.isNaN(orderDate.getTime())) {
        if (orderDate >= currentMonthStart) {
          currentMonthRevenue += total;
        } else if (orderDate >= previousMonthStart && orderDate < currentMonthStart) {
          previousMonthRevenue += total;
        }
      }

      if (!state) {
        unknownOrderCount += 1;
        continue;
      }

      const existing = totalsByState.get(state.code);
      if (!existing) continue;

      existing.total += total;
      existing.orderCount += 1;
    }

    const states = Array.from(totalsByState.values()).map((state) => ({
      ...state,
      percentage: totalRevenue ? Number(((state.total / totalRevenue) * 100).toFixed(2)) : 0,
    }));
    const topStates = states
      .filter((state) => state.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    const maxStateRevenue = states.reduce((max, state) => Math.max(max, state.total), 0);
    const monthGrowthPercent =
      previousMonthRevenue > 0
        ? Number((((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(2))
        : currentMonthRevenue > 0
          ? null
          : 0;

    return NextResponse.json(
      {
        status: "success",
        message: "State sales fetched successfully",
        data: {
          states,
          topStates,
          totalRevenue,
          currentMonthRevenue,
          previousMonthRevenue,
          monthGrowthPercent,
          orderCount,
          unknownOrderCount,
          maxStateRevenue,
          generatedAt: new Date().toISOString(),
        },
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch state sales from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
