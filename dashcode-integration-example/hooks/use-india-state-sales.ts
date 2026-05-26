"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { INDIA_STATES, type IndiaStateSalesData } from "@/lib/analytics/india-state-sales";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ApiResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};

const emptyStateSales: IndiaStateSalesData = {
  states: INDIA_STATES.map((state) => ({
    ...state,
    total: 0,
    orderCount: 0,
    percentage: 0,
  })),
  topStates: [],
  totalRevenue: 0,
  currentMonthRevenue: 0,
  previousMonthRevenue: 0,
  monthGrowthPercent: 0,
  orderCount: 0,
  unknownOrderCount: 0,
  maxStateRevenue: 0,
  generatedAt: "",
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactInrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 1,
  notation: "compact",
});

export function formatInrAmount(value: number, compact = false) {
  return (compact ? compactInrFormatter : inrFormatter).format(value);
}

export function useIndiaStateSales() {
  const [data, setData] = useState<IndiaStateSalesData>(emptyStateSales);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/analytics/state-sales", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<IndiaStateSalesData>;

      if (!response.ok) {
        throw new Error(payload.message || "Unable to fetch state sales.");
      }

      setData(payload.data ?? emptyStateSales);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to fetch state sales.");
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
      console.warn("[state-sales] Unable to initialize Supabase realtime client.", supabaseError);
      return;
    }

    const channel = supabase
      .channel("dashboard-state-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
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
