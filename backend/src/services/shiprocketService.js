const { shiprocket } = require("../config/env");

const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;
let cachedToken = "";
let cachedTokenExpiresAt = 0;

function readString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function firstString(...values) {
  for (const value of values) {
    const normalized = readString(value);
    if (normalized) return normalized;
  }
  return "";
}

function firstNumber(...values) {
  for (const value of values) {
    const normalized = readNumber(value, NaN);
    if (Number.isFinite(normalized)) return normalized;
  }
  return 0;
}

function clampPositive(value, fallback) {
  const normalized = readNumber(value, fallback);
  return normalized > 0 ? normalized : fallback;
}

function normalizeBaseUrl(value) {
  return readString(value, "https://apiv2.shiprocket.in/v1/external").replace(/\/+$/, "");
}

function normalizePhone(value) {
  return readString(value).replace(/[^\d]/g, "").slice(-12);
}

function normalizeOrderReference(value) {
  const fallback = `RAD-${Date.now()}`;
  return readString(value, fallback).replace(/\s+/g, "-").slice(0, 50);
}

function normalizeSku(value, index) {
  const sku = readString(value)
    .replace(/[^a-z0-9._-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  return sku || `RAD-SKU-${index + 1}`;
}

function formatShiprocketDate(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toISOString().slice(0, 16).replace("T", " ");
}

function splitName(value) {
  const parts = readString(value, "Customer").split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "Customer";
  return {
    firstName,
    lastName: parts.join(" ")
  };
}

function getMissingShiprocketConfig() {
  return [
    ["SHIPROCKET_API_EMAIL", shiprocket.email],
    ["SHIPROCKET_API_PASSWORD", shiprocket.password],
    ["SHIPROCKET_PICKUP_LOCATION", shiprocket.pickupLocation]
  ]
    .filter(([, value]) => !readString(value))
    .map(([name]) => name);
}

function isShiprocketConfigured() {
  return getMissingShiprocketConfig().length === 0;
}

function getShiprocketConfigStatus() {
  const missing = getMissingShiprocketConfig();
  return {
    configured: missing.length === 0,
    missing,
    baseUrl: normalizeBaseUrl(shiprocket.baseUrl),
    hasChannelId: Boolean(readString(shiprocket.channelId))
  };
}

function getReadableShiprocketError(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data || fallback;
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  if (typeof data.errors === "object") return JSON.stringify(data.errors);
  return fallback;
}

async function shiprocketRequest(path, options = {}) {
  if (typeof fetch !== "function") {
    const error = new Error("Shiprocket integration requires Node.js 18 or newer.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${normalizeBaseUrl(shiprocket.baseUrl)}${path}`, {
    method: options.method || "GET",
    headers: Object.assign(
      {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      options.token ? { Authorization: `Bearer ${options.token}` } : {},
      options.headers || {}
    ),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(getReadableShiprocketError(data, "Shiprocket request failed"));
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function getShiprocketToken(forceRefresh = false) {
  if (!isShiprocketConfigured()) {
    const error = new Error(`Shiprocket is not configured. Missing: ${getMissingShiprocketConfig().join(", ")}`);
    error.statusCode = 503;
    error.missingConfig = getMissingShiprocketConfig();
    throw error;
  }

  if (!forceRefresh && cachedToken && cachedTokenExpiresAt > Date.now()) {
    return cachedToken;
  }

  const data = await shiprocketRequest("/auth/login", {
    method: "POST",
    body: {
      email: shiprocket.email,
      password: shiprocket.password
    }
  });

  const token = readString(data && data.token);
  if (!token) {
    const error = new Error("Shiprocket did not return an auth token.");
    error.statusCode = 502;
    error.payload = data;
    throw error;
  }

  cachedToken = token;
  cachedTokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return token;
}

function normalizeCheckoutInput(input = {}) {
  const order = input.order || input;
  const createdOrder = input.createdOrder || input.supabaseOrder || input.created_order || {};
  return { order, createdOrder };
}

function getCustomerDetails(order, createdOrder) {
  const sourceCustomer = order.customer || {};
  const deliveryAddress = order.deliveryAddress || {};
  const firstName = firstString(sourceCustomer.firstName);
  const lastName = firstString(sourceCustomer.lastName);
  const fullName = firstString(
    sourceCustomer.fullName,
    sourceCustomer.name,
    createdOrder.customer_name,
    [firstName, lastName].filter(Boolean).join(" ")
  );
  const split = splitName(fullName);

  return {
    firstName: firstName || split.firstName,
    lastName: lastName || split.lastName,
    email: firstString(sourceCustomer.email, createdOrder.customer_email),
    phone: normalizePhone(firstString(sourceCustomer.phone, createdOrder.customer_phone)),
    addressLine1: firstString(
      sourceCustomer.addressLine1,
      [deliveryAddress.house, deliveryAddress.street].filter(Boolean).join(", "),
      createdOrder.delivery_address
    ),
    addressLine2: firstString(sourceCustomer.addressLine2, deliveryAddress.addressLine2),
    city: firstString(sourceCustomer.city, deliveryAddress.city, createdOrder.city),
    state: firstString(sourceCustomer.state, deliveryAddress.state, createdOrder.state),
    country: firstString(sourceCustomer.country, deliveryAddress.country, createdOrder.country, "India"),
    pincode: firstString(sourceCustomer.zipCode, sourceCustomer.pincode, deliveryAddress.pinCode, createdOrder.pincode)
  };
}

function getOrderProducts(order) {
  return (Array.isArray(order.products) ? order.products : []).map((item, index) => {
    const productId = firstString(item.productId, item.product_id, item.id, item.product && String(item.product));
    const quantity = Math.max(1, Math.floor(readNumber(item.quantity, 1)));
    const price = Math.max(0, readNumber(item.price, readNumber(item.selling_price, 0)));

    return {
      name: firstString(item.name, item.title, item.productName, "Product"),
      sku: normalizeSku(firstString(item.sku, productId), index),
      units: quantity,
      selling_price: Number(price.toFixed(2))
    };
  });
}

function getPricing(order, createdOrder) {
  const pricing = order.pricing || {};
  const itemsSubtotal = getOrderProducts(order).reduce((sum, item) => sum + item.selling_price * item.units, 0);
  const subtotal = firstNumber(pricing.subtotal, order.subtotal, createdOrder.subtotal, itemsSubtotal);
  const totalDiscount = firstNumber(pricing.discount, order.discountTotal, createdOrder.discount, createdOrder.discount_amount);
  const itemDiscount = firstNumber(pricing.itemDiscount, Math.max(0, totalDiscount - readNumber(pricing.shippingDiscount, 0)));
  const shippingDiscount = readNumber(pricing.shippingDiscount, 0);
  const deliveryCharge = firstNumber(
    pricing.effectiveDeliveryCharge,
    Math.max(0, readNumber(pricing.deliveryCharge, readNumber(createdOrder.delivery_charge, 0)) - shippingDiscount)
  );

  return {
    subtotal,
    totalDiscount,
    itemDiscount,
    deliveryCharge
  };
}

function validatePayload(payload) {
  const requiredFields = [
    "order_id",
    "order_date",
    "pickup_location",
    "billing_customer_name",
    "billing_city",
    "billing_pincode",
    "billing_state",
    "billing_country",
    "billing_email",
    "billing_phone",
    "payment_method",
    "sub_total",
    "length",
    "breadth",
    "height",
    "weight"
  ];

  const missingFields = requiredFields.filter(field => payload[field] === undefined || payload[field] === null || payload[field] === "");
  if (!Array.isArray(payload.order_items) || payload.order_items.length === 0) {
    missingFields.push("order_items");
  }

  if (missingFields.length > 0) {
    const error = new Error(`Missing Shiprocket order fields: ${missingFields.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
}

function buildShiprocketOrderPayload(input) {
  const { order, createdOrder } = normalizeCheckoutInput(input);
  const customer = getCustomerDetails(order, createdOrder);
  const products = getOrderProducts(order);
  const pricing = getPricing(order, createdOrder);
  const paymentMethod = firstString(order.paymentMethod, createdOrder.payment_method).toLowerCase();
  const reference = normalizeOrderReference(
    createdOrder.order_number ||
    createdOrder.tracking_id ||
    order.orderNumber ||
    order.trackingId ||
    order.orderId ||
    createdOrder.id
  );

  const payload = {
    order_id: reference,
    order_date: formatShiprocketDate(createdOrder.created_at || createdOrder.createdAt || order.createdAt),
    pickup_location: shiprocket.pickupLocation,
    billing_customer_name: customer.firstName,
    billing_last_name: customer.lastName,
    billing_address: customer.addressLine1,
    billing_address_2: customer.addressLine2,
    billing_city: customer.city,
    billing_pincode: customer.pincode,
    billing_state: customer.state,
    billing_country: customer.country || "India",
    billing_email: customer.email,
    billing_phone: customer.phone,
    shipping_is_billing: true,
    order_items: products,
    payment_method: paymentMethod === "cash_on_delivery" || paymentMethod === "cod" ? "COD" : "Prepaid",
    shipping_charges: Number(Math.max(0, pricing.deliveryCharge).toFixed(2)),
    total_discount: Number(Math.max(0, pricing.totalDiscount).toFixed(2)),
    sub_total: Number(Math.max(0, pricing.subtotal - pricing.itemDiscount).toFixed(2)),
    length: clampPositive(shiprocket.defaultLengthCm, 10),
    breadth: clampPositive(shiprocket.defaultBreadthCm, 10),
    height: clampPositive(shiprocket.defaultHeightCm, 10),
    weight: clampPositive(shiprocket.defaultWeightKg, 0.5)
  };

  const channelId = readString(shiprocket.channelId);
  if (channelId) {
    payload.channel_id = Number.isFinite(Number(channelId)) ? Number(channelId) : channelId;
  }

  const notes = firstString(order.notes, createdOrder.notes);
  if (notes) {
    payload.comment = notes.slice(0, 250);
  }

  validatePayload(payload);
  return payload;
}

function findNestedValue(data, keys) {
  if (!data || typeof data !== "object") return "";

  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
      return data[key];
    }
  }

  for (const value of Object.values(data)) {
    if (value && typeof value === "object") {
      const nested = findNestedValue(value, keys);
      if (nested !== "") return nested;
    }
  }

  return "";
}

function summarizeShiprocketResponse(response) {
  return {
    provider: "shiprocket",
    status: "created",
    shiprocketOrderId: readString(findNestedValue(response, ["order_id", "shiprocket_order_id"])),
    shipmentId: readString(findNestedValue(response, ["shipment_id", "shiprocket_shipment_id"])),
    awbCode: readString(findNestedValue(response, ["awb_code", "awb", "awbCode"])),
    courierName: readString(findNestedValue(response, ["courier_name", "courier", "courierName"])),
    raw: response,
    syncedAt: new Date().toISOString()
  };
}

async function createShiprocketOrder(input) {
  if (!isShiprocketConfigured()) {
    const error = new Error(`Shiprocket is not configured. Missing: ${getMissingShiprocketConfig().join(", ")}`);
    error.statusCode = 503;
    error.missingConfig = getMissingShiprocketConfig();
    throw error;
  }

  const payload = buildShiprocketOrderPayload(input);
  const token = await getShiprocketToken();
  const response = await shiprocketRequest("/orders/create/adhoc", {
    method: "POST",
    token,
    body: payload
  });

  return {
    payload,
    response,
    summary: summarizeShiprocketResponse(response)
  };
}

module.exports = {
  buildShiprocketOrderPayload,
  createShiprocketOrder,
  getShiprocketConfigStatus,
  isShiprocketConfigured,
  summarizeShiprocketResponse
};
