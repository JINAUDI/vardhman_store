"use client";

import { getCurrentAdmin, getSupabaseBrowserClient } from "./admin-auth";

export type CategoryRow = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_image_url?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CategorySeoPayload = Pick<CategoryRow, "slug" | "meta_title" | "meta_description" | "canonical_url" | "og_image_url">;

export async function getCategories() {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,description,is_active,sort_order,meta_title,meta_description,canonical_url,og_image_url,updated_at,created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as CategoryRow[];
}

export async function updateCategorySeo(categoryId: string, payload: Partial<CategorySeoPayload>) {
  await getCurrentAdmin();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("categories")
    .update(payload)
    .eq("id", categoryId)
    .select("id,name,slug,description,is_active,sort_order,meta_title,meta_description,canonical_url,og_image_url,updated_at,created_at")
    .single();

  if (error) throw error;
  return data as CategoryRow;
}
