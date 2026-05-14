"use client";

import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export type AdminRole = "admin" | "manager" | "staff";

export type AdminUser = {
  id: string;
  auth_user_id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
};

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase admin auth env is not configured");
  }

  browserClient =
    browserClient ||
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

  return browserClient;
}

export async function getCurrentAdmin(): Promise<{ user: User; admin: AdminUser }> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("id,auth_user_id,email,role,is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (adminError || !admin) {
    await supabase.auth.signOut();
    throw new Error("NOT_ADMIN");
  }

  return { user, admin: admin as AdminUser };
}

export function roleCan(role: AdminRole | undefined, permission: "manage_admins" | "manage_catalog" | "manage_orders" | "view_orders") {
  if (role === "admin") return true;
  if (role === "manager") return permission === "manage_catalog" || permission === "manage_orders" || permission === "view_orders";
  if (role === "staff") return permission === "view_orders" || permission === "manage_orders";
  return false;
}
