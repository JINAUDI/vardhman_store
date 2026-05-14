"use client";

import { getCurrentAdmin, getSupabaseBrowserClient } from "./admin-auth";

export type SearchEventProduct = {
  id?: string | null;
  title?: string | null;
  name?: string | null;
  sku?: string | null;
};

export type SearchEventRow = {
  id: string;
  query: string;
  session_id?: string | null;
  auth_user_id?: string | null;
  results_count: number;
  clicked_product_id?: string | null;
  created_at: string;
  products?: SearchEventProduct | SearchEventProduct[] | null;
};

export type ProductSearchKeywordsRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  search_keywords?: string | null;
};

export type AnalyticsEventRow = {
  id?: string;
  event_name?: string | null;
  event_type?: string | null;
  product_id?: string | null;
  created_at?: string | null;
};

async function getSearchEvents(selectClause: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("search_events")
    .select(selectClause)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data || []) as SearchEventRow[];
}

export async function getSearchAnalytics() {
  await getCurrentAdmin();

  let searchEvents: SearchEventRow[] = [];
  try {
    searchEvents = await getSearchEvents(
      "id,query,session_id,auth_user_id,results_count,clicked_product_id,created_at,products(id,title,name,sku)"
    );
  } catch {
    searchEvents = await getSearchEvents(
      "id,query,session_id,auth_user_id,results_count,clicked_product_id,created_at"
    );
  }

  const supabase = getSupabaseBrowserClient();
  const productsResult = await supabase
    .from("products")
    .select("id,title,name,sku,category,search_keywords")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (productsResult.error) throw productsResult.error;

  let analyticsEvents: AnalyticsEventRow[] = [];
  let analyticsEventsAvailable = false;
  try {
    const analyticsResult = await supabase
      .from("analytics_events")
      .select("id,event_name,product_id,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!analyticsResult.error) {
      analyticsEventsAvailable = true;
      analyticsEvents = (analyticsResult.data || []) as AnalyticsEventRow[];
    }
  } catch {
    analyticsEvents = [];
  }

  return {
    searchEvents,
    products: (productsResult.data || []) as ProductSearchKeywordsRow[],
    analyticsEvents,
    analyticsEventsAvailable
  };
}
