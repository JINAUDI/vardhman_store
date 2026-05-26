"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type LiveDashboardOrder = {
  id: string;
  orderNumber: string;
  trackingId: string;
  customerName: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt?: string | null;
};

export type LiveDashboardNotification = {
  id: string;
  title: string;
  message: string;
  orderId: string;
  trackingId: string;
  customerName: string;
  total: number;
  isRead: boolean;
  createdAt?: string | null;
};

export type LiveOrderDashboardData = {
  newOrdersToday: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  todayRevenue: number;
  unreadNotifications: number;
  latestOrders: LiveDashboardOrder[];
  latestNotifications: LiveDashboardNotification[];
  generatedAt: string;
};

type ApiResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};

const emptyDashboardData: LiveOrderDashboardData = {
  newOrdersToday: 0,
  pendingOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  todayRevenue: 0,
  unreadNotifications: 0,
  latestOrders: [],
  latestNotifications: [],
  generatedAt: "",
};

export function useLiveOrderDashboard() {
  const [data, setData] = useState<LiveOrderDashboardData>(emptyDashboardData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/analytics/live-orders", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<LiveOrderDashboardData>;

      if (!response.ok) {
        throw new Error(payload.message || "Unable to fetch live order dashboard.");
      }

      setData(payload.data ?? emptyDashboardData);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to fetch live order dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;

    try {
      supabase = getSupabaseBrowserClient();
    } catch (supabaseError) {
      console.warn("[live-order-dashboard] Unable to initialize Supabase realtime client.", supabaseError);
      return;
    }

    const ordersChannel = supabase
      .channel("live-dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void refresh();
      })
      .subscribe();

    const notificationsChannel = supabase
      .channel("live-dashboard-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(notificationsChannel);
    };
  }, [refresh]);

  return useMemo(
    () => ({
      data,
      error,
      isLoading,
      refresh,
    }),
    [data, error, isLoading, refresh]
  );
}
