import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSupabaseConfigSummary,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getReadableSupabaseErrorMessage } from "@/lib/supabase/errors";
import type { Address, Customer } from "@/lib/store/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JsonRecord = Record<string, unknown>;

type CustomerAccumulator = Customer & {
  authUserId?: string;
  emailKey?: string;
  wishlistCount?: number;
  reviewCount?: number;
  returnRequests?: Array<{ id: string; orderId?: string; reason?: string; status?: string; createdAt?: string }>;
  wishlistItems?: Array<{ id: string; productId?: string; createdAt?: string }>;
  reviewItems?: Array<{ id: string; productId?: string; status?: string; createdAt?: string }>;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizePhone(value: unknown) {
  return readString(value).replace(/\D/g, "");
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readDate(value: unknown, fallback = new Date().toISOString()) {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function makeAddress(id: string, row: JsonRecord): Address {
  const addressId = readString(row.id, `${id}_address`);
  const streetParts = [
    readString(row.address_line1 ?? row.delivery_address ?? row.address ?? row.street),
    readString(row.address_line2),
  ].filter(Boolean);
  const rawLabel = readString(row.address_type ?? row.label, "Shipping");
  const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : "Shipping";
  const hasDefaultField = Object.prototype.hasOwnProperty.call(row, "is_default") || Object.prototype.hasOwnProperty.call(row, "isDefault");

  return {
    id: addressId,
    label,
    street: streetParts.join(", "),
    city: readString(row.city),
    state: readString(row.state),
    zipCode: readString(row.pincode ?? row.zipCode ?? row.zip_code),
    country: readString(row.country, "India"),
    isDefault: hasDefaultField ? row.is_default === true || row.isDefault === true : true,
  };
}
function makeCustomerFromProfile(row: JsonRecord): CustomerAccumulator {
  const id = readString(row.id ?? row.auth_user_id ?? row.email);
  const email = readString(row.email);
  const name = readString(row.full_name ?? row.name, email || "Customer");
  const isActive = row.is_active !== false;

  return {
    id,
    authUserId: readString(row.auth_user_id),
    emailKey: email.toLowerCase(),
    name,
    email,
    phone: readString(row.phone),
    avatar: "",
    addresses: [],
    totalSpend: 0,
    totalOrders: 0,
    totalReturns: 0,
    status: isActive ? "active" : "inactive",
    joinedAt: readDate(row.created_at ?? row.createdAt),
    lastOrderAt: undefined,
    wishlistCount: 0,
    reviewCount: 0,
    returnRequests: [],
  };
}

function makeCustomerFromOrder(row: JsonRecord): CustomerAccumulator {
  const email = readString(row.customer_email ?? row.email);
  const phone = readString(row.customer_phone ?? row.phone);
  const id = readString(row.customer_id ?? row.auth_user_id ?? row.customerId ?? row.authUserId, email || phone || readString(row.id));

  return {
    id,
    authUserId: readString(row.auth_user_id ?? row.authUserId),
    emailKey: email.toLowerCase(),
    name: readString(row.customer_name ?? row.name, email || phone || "Customer"),
    email,
    phone,
    avatar: "",
    addresses: [makeAddress(id, row)].filter((address) => address.street || address.city || address.zipCode),
    totalSpend: 0,
    totalOrders: 0,
    totalReturns: 0,
    status: "active",
    joinedAt: readDate(row.created_at ?? row.createdAt),
    lastOrderAt: undefined,
    wishlistCount: 0,
    reviewCount: 0,
    returnRequests: [],
  };
}

function mergeCustomer(existing: CustomerAccumulator, incoming: CustomerAccumulator) {
  existing.name = existing.name === "Customer" ? incoming.name : existing.name;
  existing.email = existing.email || incoming.email;
  existing.phone = existing.phone || incoming.phone;
  existing.authUserId = existing.authUserId || incoming.authUserId;
  existing.emailKey = existing.emailKey || incoming.emailKey;
  existing.wishlistCount = Math.max(existing.wishlistCount || 0, incoming.wishlistCount || 0);
  existing.reviewCount = Math.max(existing.reviewCount || 0, incoming.reviewCount || 0);
  existing.returnRequests = existing.returnRequests || [];
  existing.wishlistItems = existing.wishlistItems || [];
  existing.reviewItems = existing.reviewItems || [];
  existing.joinedAt = new Date(existing.joinedAt) < new Date(incoming.joinedAt) ? existing.joinedAt : incoming.joinedAt;
  const knownAddressKeys = new Set(existing.addresses.map((address) => `${address.street}|${address.city}|${address.zipCode}`));
  incoming.addresses.forEach((address) => {
    const key = `${address.street}|${address.city}|${address.zipCode}`;
    if (!knownAddressKeys.has(key)) {
      existing.addresses.push(address);
      knownAddressKeys.add(key);
    }
  });
}

function findCustomerForOrder(customers: Map<string, CustomerAccumulator>, row: JsonRecord) {
  const keys = [
    readString(row.customer_id),
    readString(row.auth_user_id),
    readString(row.customer_email).toLowerCase(),
    readString(row.customer_phone),
    normalizePhone(row.customer_phone),
  ].filter(Boolean);

  for (const key of keys) {
    const customer = customers.get(key);
    if (customer) return customer;
  }

  const next = makeCustomerFromOrder(row);
  customers.set(next.id, next);
  if (next.authUserId) customers.set(next.authUserId, next);
  if (next.emailKey) customers.set(next.emailKey, next);
  if (next.phone) customers.set(next.phone, next);
  const phoneKey = normalizePhone(next.phone);
  if (phoneKey) customers.set(phoneKey, next);
  return next;
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
    const [
      { data: customerRows, error: customersError },
      { data: customerAddressRows, error: customerAddressesError },
      { data: orderRows, error: ordersError },
      { data: returnRows, error: returnsError },
      { data: wishlistRows, error: wishlistError },
      { data: reviewRows, error: reviewsError },
    ] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("customer_addresses").select("*").order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id,customer_id,auth_user_id,customer_name,customer_email,customer_phone,delivery_address,city,state,pincode,country,total,status,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("return_requests").select("id,order_id,auth_user_id,customer_email,reason,status,created_at").order("created_at", { ascending: false }),
      supabase.from("wishlist").select("id,auth_user_id,session_id,product_id,created_at"),
      supabase.from("reviews").select("id,auth_user_id,product_id,status,created_at"),
    ]);

    if (customersError) throw customersError;
    if (customerAddressesError) throw customerAddressesError;
    if (ordersError) throw ordersError;
    if (returnsError) throw returnsError;
    if (wishlistError) throw wishlistError;
    if (reviewsError) throw reviewsError;

    const customersByKey = new Map<string, CustomerAccumulator>();

    (customerRows ?? []).forEach((row) => {
      const customer = makeCustomerFromProfile(row as JsonRecord);
      const keys = [customer.id, customer.authUserId, customer.emailKey, customer.phone, normalizePhone(customer.phone)].filter(Boolean) as string[];
      keys.forEach((key) => {
        const existing = customersByKey.get(key);
        if (existing) {
          mergeCustomer(existing, customer);
        } else {
          customersByKey.set(key, customer);
        }
      });
    });

    (customerAddressRows ?? []).forEach((row) => {
      const addressRow = row as JsonRecord;
      const keys = [
        readString(addressRow.customer_id),
        readString(addressRow.auth_user_id),
      ].filter(Boolean);
      let customer: CustomerAccumulator | undefined;
      for (const key of keys) {
        customer = customersByKey.get(key);
        if (customer) break;
      }
      if (!customer) return;

      const address = makeAddress(readString(addressRow.id, customer.id), addressRow);
      const key = `${address.street}|${address.city}|${address.zipCode}`;
      const knownAddressKeys = new Set(customer.addresses.map((item) => `${item.street}|${item.city}|${item.zipCode}`));
      if ((address.street || address.city || address.zipCode) && !knownAddressKeys.has(key)) {
        customer.addresses.unshift(address);
      }
    });

    (orderRows ?? []).forEach((row) => {
      const order = row as JsonRecord;
      const customer = findCustomerForOrder(customersByKey, order);
      const total = readNumber(order.total);
      const createdAt = readDate(order.created_at);
      customer.totalSpend += total;
      customer.totalOrders += 1;
      if (readString(order.status) === "returned") customer.totalReturns += 1;
      if (!customer.lastOrderAt || new Date(createdAt) > new Date(customer.lastOrderAt)) {
        customer.lastOrderAt = createdAt;
      }
      if (customer.addresses.length === 0) {
        const address = makeAddress(customer.id, order);
        if (address.street || address.city || address.zipCode) customer.addresses.push(address);
      }
    });


    (returnRows ?? []).forEach((row) => {
      const request = row as JsonRecord;
      const customer = findCustomerForOrder(customersByKey, {
        id: request.order_id,
        auth_user_id: request.auth_user_id,
        customer_email: request.customer_email,
        total: 0,
        status: "returned",
        created_at: request.created_at,
      });
      customer.totalReturns += 1;
      customer.returnRequests = customer.returnRequests || [];
      customer.returnRequests.push({
        id: readString(request.id),
        orderId: readString(request.order_id),
        reason: readString(request.reason),
        status: readString(request.status),
        createdAt: readDate(request.created_at),
      });
    });

    (wishlistRows ?? []).forEach((row) => {
      const wishlist = row as JsonRecord;
      const authUserId = readString(wishlist.auth_user_id);
      if (!authUserId) return;
      const customer = customersByKey.get(authUserId);
      if (!customer) return;
      customer.wishlistCount = (customer.wishlistCount || 0) + 1;
      customer.wishlistItems = customer.wishlistItems || [];
      customer.wishlistItems.push({
        id: readString(wishlist.id),
        productId: readString(wishlist.product_id),
        createdAt: readDate(wishlist.created_at),
      });
    });

    (reviewRows ?? []).forEach((row) => {
      const review = row as JsonRecord;
      const authUserId = readString(review.auth_user_id);
      if (!authUserId) return;
      const customer = customersByKey.get(authUserId);
      if (!customer) return;
      customer.reviewCount = (customer.reviewCount || 0) + 1;
      customer.reviewItems = customer.reviewItems || [];
      customer.reviewItems.push({
        id: readString(review.id),
        productId: readString(review.product_id),
        status: readString(review.status),
        createdAt: readDate(review.created_at),
      });
    });
    const uniqueCustomers = Array.from(new Set(customersByKey.values()))
      .filter((customer) => customer.email || customer.phone || customer.totalOrders > 0)
      .map(({ emailKey: _emailKey, ...customer }) => ({
        ...customer,
        addresses: customer.addresses.length
          ? customer.addresses
          : [
              {
                id: `${customer.id}_address`,
                label: "Shipping",
                street: "",
                city: "",
                state: "",
                zipCode: "",
                country: "India",
                isDefault: true,
              },
            ],
      }))
      .sort((left, right) => new Date(right.lastOrderAt || right.joinedAt).getTime() - new Date(left.lastOrderAt || left.joinedAt).getTime());

    return NextResponse.json(
      {
        status: "success",
        message: "Customers fetched successfully",
        data: uniqueCustomers,
        storage: "supabase",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: getReadableSupabaseErrorMessage(error, "Unable to fetch customers from Supabase."),
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}



