type JsonRecord = Record<string, unknown>;

const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;

let cachedToken = "";
let cachedTokenExpiresAt = 0;

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = readString(value);
    if (normalized) return normalized;
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const normalized = readNumber(value, Number.NaN);
    if (Number.isFinite(normalized)) return normalized;
  }
  return 0;
}

function normalizeBaseUrl() {
  return readString(process.env.SHIPROCKET_BASE_URL, "https://apiv2.shiprocket.in/v1/external").replace(/\/+$/, "");
}

function normalizePhone(value: unknown) {
  return readString(value).replace(/[^\d]/g, "").slice(-12);
}

function normalizeOrderReference(value: unknown) {
  return readString(value, `RAD-${Date.now()}`).replace(/\s+/g, "-").slice(0, 50);
}

function normalizeSku(value: unknown, index: number) {
  const sku = readString(value)
    .replace(/[^a-z0-9._-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  return sku || `RAD-SKU-${index + 1}`;
}

function splitName(value: unknown) {
  const parts = readString(value, "Customer").split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "Customer";

  return {
    firstName,
    lastName: parts.join(" "),
  };
}

function formatShiprocketDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toISOString().slice(0, 16).replace("T", " ");
}

function getShiprocketEnv() {
  return {
    baseUrl: normalizeBaseUrl(),
    email: readString(process.env.SHIPROCKET_API_EMAIL),
    password: readString(process.env.SHIPROCKET_API_PASSWORD),
    pickupLocation: readString(process.env.SHIPROCKET_PICKUP_LOCATION),
    channelId: readString(process.env.SHIPROCKET_CHANNEL_ID),
    defaultLengthCm: readNumber(process.env.SHIPROCKET_DEFAULT_LENGTH_CM, 10),
    defaultBreadthCm: readNumber(process.env.SHIPROCKET_DEFAULT_BREADTH_CM, 10),
    defaultHeightCm: readNumber(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM, 10),
    defaultWeightKg: readNumber(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG, 0.5),
  };
}

export function getShiprocketConfigStatus() {
  const env = getShiprocketEnv();
  const missing = [
    ["SHIPROCKET_API_EMAIL", env.email],
    ["SHIPROCKET_API_PASSWORD", env.password],
    ["SHIPROCKET_PICKUP_LOCATION", env.pickupLocation],
  ]
    .filter(([, value]) => !readString(value))
    .map(([name]) => name);

  return {
    configured: missing.length === 0,
    missing,
    baseUrl: env.baseUrl,
    hasChannelId: Boolean(env.channelId),
  };
}

function getReadableShiprocketError(data: unknown, fallback: string) {
  if (!data) return fallback;
  if (typeof data === "string") return data || fallback;

  const record = data as JsonRecord;
  return (
    readString(record.message) ||
    readString(record.error) ||
    (typeof record.errors === "object" && record.errors ? JSON.stringify(record.errors) : "") ||
    fallback
  );
}

async function shiprocketRequest(path: string, options: { method?: string; token?: string; body?: JsonRecord } = {}) {
  const env = getShiprocketEnv();
  const response = await fetch(`${env.baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(getReadableShiprocketError(data, "Shiprocket request failed"));
    (error as Error & { statusCode?: number; payload?: unknown }).statusCode = response.status;
    (error as Error & { statusCode?: number; payload?: unknown }).payload = data;
    throw error;
  }

  return data;
}

async function getShiprocketToken() {
  const env = getShiprocketEnv();
  const status = getShiprocketConfigStatus();

  if (!status.configured) {
    const error = new Error(`Shiprocket is not configured. Missing: ${status.missing.join(", ")}`);
    (error as Error & { statusCode?: number; missingConfig?: string[] }).statusCode = 503;
    (error as Error & { statusCode?: number; missingConfig?: string[] }).missingConfig = status.missing;
    throw error;
  }

  if (cachedToken && cachedTokenExpiresAt > Date.now()) {
    return cachedToken;
  }

  const data = (await shiprocketRequest("/auth/login", {
    method: "POST",
    body: {
      email: env.email,
      password: env.password,
    },
  })) as JsonRecord;

  const token = readString(data.token);
  if (!token) {
    const error = new Error("Shiprocket did not return an auth token.");
    (error as Error & { statusCode?: number; payload?: unknown }).statusCode = 502;
    (error as Error & { statusCode?: number; payload?: unknown }).payload = data;
    throw error;
  }

  cachedToken = token;
  cachedTokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return token;
}

function getCustomerDetails(order: JsonRecord, createdOrder: JsonRecord) {
  const sourceCustomer = (order.customer || {}) as JsonRecord;
  const deliveryAddress = (order.deliveryAddress || {}) as JsonRecord;
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
    pincode: firstString(sourceCustomer.zipCode, sourceCustomer.pincode, deliveryAddress.pinCode, createdOrder.pincode),
  };
}

function getOrderProducts(order: JsonRecord) {
  const products = Array.isArray(order.products) ? (order.products as JsonRecord[]) : [];

  return products.map((item, index) => {
    const productId = firstString(item.productId, item.product_id, item.id, item.product);
    const quantity = Math.max(1, Math.floor(readNumber(item.quantity, 1)));
    const price = Math.max(0, readNumber(item.price, readNumber(item.selling_price, 0)));

    return {
      name: firstString(item.name, item.title, item.productName, "Product"),
      sku: normalizeSku(firstString(item.sku, productId), index),
      units: quantity,
      selling_price: Number(price.toFixed(2)),
    };
  });
}

function getPricing(order: JsonRecord, createdOrder: JsonRecord) {
  const pricing = (order.pricing || {}) as JsonRecord;
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
    deliveryCharge,
  };
}

function validatePayload(payload: JsonRecord) {
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
    "weight",
  ];

  const missingFields = requiredFields.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === "");
  if (!Array.isArray(payload.order_items) || payload.order_items.length === 0) {
    missingFields.push("order_items");
  }

  if (missingFields.length > 0) {
    const error = new Error(`Missing Shiprocket order fields: ${missingFields.join(", ")}`);
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
}

export function buildShiprocketOrderPayload(input: { order?: JsonRecord; createdOrder?: JsonRecord; supabaseOrder?: JsonRecord }) {
  const env = getShiprocketEnv();
  const order = input.order || input as JsonRecord;
  const createdOrder = input.createdOrder || input.supabaseOrder || {};
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

  const payload: JsonRecord = {
    order_id: reference,
    order_date: formatShiprocketDate(createdOrder.created_at || createdOrder.createdAt || order.createdAt),
    pickup_location: env.pickupLocation,
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
    length: env.defaultLengthCm > 0 ? env.defaultLengthCm : 10,
    breadth: env.defaultBreadthCm > 0 ? env.defaultBreadthCm : 10,
    height: env.defaultHeightCm > 0 ? env.defaultHeightCm : 10,
    weight: env.defaultWeightKg > 0 ? env.defaultWeightKg : 0.5,
  };

  if (env.channelId) {
    payload.channel_id = Number.isFinite(Number(env.channelId)) ? Number(env.channelId) : env.channelId;
  }

  const notes = firstString(order.notes, createdOrder.notes);
  if (notes) {
    payload.comment = notes.slice(0, 250);
  }

  validatePayload(payload);
  return payload;
}

function findNestedValue(data: unknown, keys: string[]): unknown {
  if (!data || typeof data !== "object") return "";
  const record = data as JsonRecord;

  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const nested = findNestedValue(value, keys);
      if (nested !== "") return nested;
    }
  }

  return "";
}

export function summarizeShiprocketResponse(response: unknown) {
  return {
    provider: "shiprocket",
    status: "created",
    shiprocketOrderId: readString(findNestedValue(response, ["order_id", "shiprocket_order_id"])),
    shipmentId: readString(findNestedValue(response, ["shipment_id", "shiprocket_shipment_id"])),
    awbCode: readString(findNestedValue(response, ["awb_code", "awb", "awbCode"])),
    courierName: readString(findNestedValue(response, ["courier_name", "courier", "courierName"])),
    raw: response,
    syncedAt: new Date().toISOString(),
  };
}

export async function createShiprocketOrder(input: { order?: JsonRecord; createdOrder?: JsonRecord; supabaseOrder?: JsonRecord }) {
  const payload = buildShiprocketOrderPayload(input);
  const token = await getShiprocketToken();
  const response = await shiprocketRequest("/orders/create/adhoc", {
    method: "POST",
    token,
    body: payload,
  });

  return {
    payload,
    response,
    summary: summarizeShiprocketResponse(response),
  };
}
