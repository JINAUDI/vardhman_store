"use client";

import { useCallback, useEffect } from "react";
import { useSetAtom } from "jotai";
import { couponsAtom, customersAtom, ordersAtom, productsAtom } from "@/lib/store/ecommerce-store";
import type { Coupon, Customer, Order, Product } from "@/lib/store/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ApiResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

const legacyPersistedCollectionKeys = [
  "ecom_products",
  "ecom_orders",
  "ecom_customers",
  "ecom_coupons",
  "ecom_banners",
  "ecom_returns",
  "ecom_notifications",
  "ecom_activity_logs",
];

function clearLegacyPersistedCollections() {
  if (typeof window === "undefined") return;

  legacyPersistedCollectionKeys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
  });
}

async function fetchApiData<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(payload.message || `Unable to fetch ${url}`);
  }

  return payload.data;
}

export default function EcommerceSupabaseSync() {
  const setProducts = useSetAtom(productsAtom);
  const setOrders = useSetAtom(ordersAtom);
  const setCustomers = useSetAtom(customersAtom);
  const setCoupons = useSetAtom(couponsAtom);


  useEffect(() => {
    clearLegacyPersistedCollections();
    setProducts([]);
    setOrders([]);
    setCustomers([]);
    setCoupons([]);
  }, [setProducts, setOrders, setCustomers, setCoupons]);

  const syncProducts = useCallback(async () => {
    const data = await fetchApiData<Product[]>("/api/products");
    if (Array.isArray(data)) setProducts(data);
  }, [setProducts]);

  const syncOrders = useCallback(async () => {
    const data = await fetchApiData<Order[]>("/api/orders");
    if (Array.isArray(data)) setOrders(data);
  }, [setOrders]);

  const syncCustomers = useCallback(async () => {
    const data = await fetchApiData<Customer[]>("/api/customers");
    if (Array.isArray(data)) setCustomers(data);
  }, [setCustomers]);

  const syncDiscounts = useCallback(async () => {
    const data = await fetchApiData<Coupon[]>("/api/discounts");
    if (Array.isArray(data)) setCoupons(data);
  }, [setCoupons]);

  useEffect(() => {
    void Promise.allSettled([
      syncProducts(),
      syncOrders(),
      syncCustomers(),
      syncDiscounts(),
    ]).then((results) => {
      results.forEach((result) => {
        if (result.status === "rejected") {
          console.warn("[ecommerce-sync] Supabase sync failed.", result.reason);
        }
      });
    });
  }, [syncProducts, syncOrders, syncCustomers, syncDiscounts]);

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;

    try {
      supabase = getSupabaseBrowserClient();
    } catch (error) {
      console.warn("[ecommerce-sync] Unable to initialize Supabase realtime client.", error);
      return;
    }

    const ordersChannel = supabase
      .channel("dashboard-ecommerce-orders-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void syncOrders().catch((error) => console.warn("[ecommerce-sync] Unable to refresh orders.", error));
        void syncCustomers().catch((error) => console.warn("[ecommerce-sync] Unable to refresh customers.", error));
      })
      .subscribe((status) => console.log("Ecommerce orders realtime status:", status));

    const productsChannel = supabase
      .channel("dashboard-ecommerce-products-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        void syncProducts().catch((error) => console.warn("[ecommerce-sync] Unable to refresh products.", error));
      })
      .subscribe((status) => console.log("Ecommerce products realtime status:", status));

    return () => {
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(productsChannel);
    };
  }, [syncCustomers, syncOrders, syncProducts]);

  return null;
}
