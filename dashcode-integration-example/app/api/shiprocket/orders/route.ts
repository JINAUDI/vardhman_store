import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createShiprocketOrder } from "@/lib/shiprocket/service";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JsonRecord = Record<string, unknown>;

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getStatusCode(error: unknown) {
  const candidate = error as { statusCode?: unknown; status?: unknown } | null;
  const statusCode = Number(candidate?.statusCode || candidate?.status);
  return Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
}

function getSupabaseOrderId(createdOrder: JsonRecord) {
  return readString(createdOrder.id || createdOrder.order_id);
}

function isMissingColumnError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "").toLowerCase()
      : String(error || "").toLowerCase();

  return message.includes("column") || message.includes("schema cache");
}

function buildShiprocketSuccessPayload(summary: JsonRecord) {
  const awbCode = readString(summary.awbCode);
  const trackingValue = awbCode || readString(summary.shipmentId) || readString(summary.shiprocketOrderId);

  return {
    courier: readString(summary.courierName, "Shiprocket"),
    courier_name: readString(summary.courierName, "Shiprocket"),
    courier_tracking_number: trackingValue,
    shipping_status: awbCode ? "ready_to_ship" : "shiprocket_order_created",
    tracking_status: awbCode ? "Ready to Ship" : "Shiprocket Order Created",
    tracking_updated_at: new Date().toISOString(),
    fulfillment_status: "unfulfilled",
    shiprocket_order_id: readString(summary.shiprocketOrderId),
    shiprocket_shipment_id: readString(summary.shipmentId),
    shiprocket_awb_code: awbCode,
    shiprocket_sync_status: "created",
    shiprocket_synced_at: new Date().toISOString(),
    shiprocket_last_error: null,
  };
}

function buildShiprocketFailurePayload(error: unknown) {
  const message = error instanceof Error ? error.message : "Shiprocket sync failed";

  return {
    shiprocket_sync_status: "failed",
    shiprocket_last_error: message.slice(0, 500),
    shiprocket_synced_at: new Date().toISOString(),
  };
}

function stripShiprocketColumns(payload: JsonRecord) {
  return Object.keys(payload).reduce<JsonRecord>((nextPayload, key) => {
    if (!key.startsWith("shiprocket_")) {
      nextPayload[key] = payload[key];
    }
    return nextPayload;
  }, {});
}

function minimalTrackingPayload(payload: JsonRecord): JsonRecord {
  return {
    courier_name: payload.courier_name,
    courier_tracking_number: payload.courier_tracking_number,
    tracking_status: payload.tracking_status,
    tracking_updated_at: payload.tracking_updated_at,
  };
}

async function patchSupabaseOrder(orderId: string, payload: JsonRecord) {
  const attempts: JsonRecord[] = [
    payload,
    stripShiprocketColumns(payload),
    minimalTrackingPayload(payload),
  ];
  let lastError: unknown = null;
  const supabase = createSupabaseAdminClient();

  for (const attempt of attempts) {
    const cleanPayload = Object.keys(attempt).reduce<JsonRecord>((nextPayload, key) => {
      if (attempt[key] !== undefined && attempt[key] !== "") {
        nextPayload[key] = attempt[key];
      }
      return nextPayload;
    }, {});

    if (!Object.keys(cleanPayload).length) {
      continue;
    }

    const { error } = await supabase.from("orders").update(cleanPayload).eq("id", orderId);
    if (!error) {
      return true;
    }

    lastError = error;
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  if (lastError) throw lastError;
  return false;
}

async function syncShiprocketSuccess(createdOrder: JsonRecord, summary: JsonRecord) {
  const orderId = getSupabaseOrderId(createdOrder);
  if (!orderId) return false;
  return patchSupabaseOrder(orderId, buildShiprocketSuccessPayload(summary));
}

async function syncShiprocketFailure(createdOrder: JsonRecord, error: unknown) {
  const orderId = getSupabaseOrderId(createdOrder);
  if (!orderId) return false;
  return patchSupabaseOrder(orderId, buildShiprocketFailurePayload(error));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as JsonRecord;
  const order = (body.order || body) as JsonRecord;
  const createdOrder = (body.createdOrder || body.supabaseOrder || body.created_order || {}) as JsonRecord;

  try {
    const result = await createShiprocketOrder({ order, createdOrder });

    try {
      await syncShiprocketSuccess(createdOrder, result.summary);
    } catch (syncError) {
      console.warn("[Shiprocket] Supabase shipping sync failed:", syncError);
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Order sent to Shiprocket.",
        data: result.summary,
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    try {
      await syncShiprocketFailure(createdOrder, error);
    } catch (syncError) {
      console.warn("[Shiprocket] Supabase failure sync failed:", syncError);
    }

    return NextResponse.json(
      {
        status: "fail",
        message: error instanceof Error ? error.message : "Shiprocket order sync failed.",
      },
      { status: getStatusCode(error), headers: CORS_HEADERS }
    );
  }
}
