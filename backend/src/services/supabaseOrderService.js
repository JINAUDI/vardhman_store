const { supabaseUrl, supabaseServiceRoleKey } = require("../config/env");

function readString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function isSupabaseShippingSyncConfigured() {
  return Boolean(readString(supabaseUrl) && readString(supabaseServiceRoleKey));
}

function getSupabaseOrderId(createdOrder) {
  return readString(createdOrder && (createdOrder.id || createdOrder.order_id));
}

function getReadableSupabaseError(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data || fallback;
  return readString(data.message) || readString(data.details) || readString(data.hint) || fallback;
}

function isMissingColumnError(error) {
  const message = String(error && error.message ? error.message : error || "").toLowerCase();
  return message.includes("column") || message.includes("schema cache");
}

async function patchSupabaseOrder(orderId, payload) {
  const response = await fetch(`${readString(supabaseUrl).replace(/\/+$/, "")}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {}

    const error = new Error(getReadableSupabaseError(data, "Unable to update Supabase order shipping fields."));
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }
}

function buildShiprocketSuccessPayload(summary) {
  const trackingValue = readString(summary.awbCode) || readString(summary.shipmentId) || readString(summary.shiprocketOrderId);

  return {
    courier: readString(summary.courierName, "Shiprocket"),
    courier_name: readString(summary.courierName, "Shiprocket"),
    courier_tracking_number: trackingValue,
    shipping_status: readString(summary.awbCode) ? "ready_to_ship" : "shiprocket_order_created",
    tracking_status: readString(summary.awbCode) ? "Ready to Ship" : "Shiprocket Order Created",
    tracking_updated_at: new Date().toISOString(),
    fulfillment_status: "unfulfilled",
    shiprocket_order_id: readString(summary.shiprocketOrderId),
    shiprocket_shipment_id: readString(summary.shipmentId),
    shiprocket_awb_code: readString(summary.awbCode),
    shiprocket_sync_status: "created",
    shiprocket_synced_at: new Date().toISOString(),
    shiprocket_last_error: null
  };
}

function buildShiprocketFailurePayload(error) {
  return {
    shiprocket_sync_status: "failed",
    shiprocket_last_error: String(error && error.message ? error.message : error || "Shiprocket sync failed").slice(0, 500),
    shiprocket_synced_at: new Date().toISOString()
  };
}

function stripShiprocketColumns(payload) {
  return Object.keys(payload).reduce((nextPayload, key) => {
    if (!key.startsWith("shiprocket_")) {
      nextPayload[key] = payload[key];
    }
    return nextPayload;
  }, {});
}

function minimalTrackingPayload(payload) {
  return {
    courier_name: payload.courier_name,
    courier_tracking_number: payload.courier_tracking_number,
    tracking_status: payload.tracking_status,
    tracking_updated_at: payload.tracking_updated_at
  };
}

async function patchWithFallbacks(orderId, payload) {
  const attempts = [
    payload,
    stripShiprocketColumns(payload),
    minimalTrackingPayload(payload)
  ];
  let lastError = null;

  for (const attempt of attempts) {
    const cleanPayload = Object.keys(attempt).reduce((nextPayload, key) => {
      if (attempt[key] !== undefined && attempt[key] !== "") {
        nextPayload[key] = attempt[key];
      }
      return nextPayload;
    }, {});

    if (Object.keys(cleanPayload).length === 0) {
      continue;
    }

    try {
      await patchSupabaseOrder(orderId, cleanPayload);
      return true;
    } catch (error) {
      lastError = error;
      if (!isMissingColumnError(error)) {
        throw error;
      }
    }
  }

  if (lastError) throw lastError;
  return false;
}

async function syncSupabaseOrderShiprocketSuccess(createdOrder, summary) {
  if (!isSupabaseShippingSyncConfigured()) return false;

  const orderId = getSupabaseOrderId(createdOrder);
  if (!orderId) return false;

  await patchWithFallbacks(orderId, buildShiprocketSuccessPayload(summary));
  return true;
}

async function syncSupabaseOrderShiprocketFailure(createdOrder, error) {
  if (!isSupabaseShippingSyncConfigured()) return false;

  const orderId = getSupabaseOrderId(createdOrder);
  if (!orderId) return false;

  await patchWithFallbacks(orderId, buildShiprocketFailurePayload(error));
  return true;
}

module.exports = {
  isSupabaseShippingSyncConfigured,
  syncSupabaseOrderShiprocketFailure,
  syncSupabaseOrderShiprocketSuccess
};
