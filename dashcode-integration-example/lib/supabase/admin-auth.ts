import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AdminUser = {
  id: string;
  authUserId: string;
  email: string;
  role: string;
  isActive: boolean;
};

type AdminUserRow = {
  id: string;
  auth_user_id: string;
  email: string;
  role: string | null;
  is_active: boolean | null;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function mapAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: normalizeEmail(row.email),
    role: row.role || "admin",
    isActive: row.is_active !== false,
  };
}

export async function getActiveAdminUser(authUserId?: string | null, email?: string | null) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseAdminClient();

  if (authUserId) {
    const { data, error } = await supabase
      .from("admin_users")
      .select("id,auth_user_id,email,role,is_active")
      .eq("auth_user_id", authUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.warn("[auth] Unable to verify admin user by auth id.", error);
      return null;
    }

    if (data) {
      return mapAdminUser(data as AdminUserRow);
    }
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("id,auth_user_id,email,role,is_active")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn("[auth] Unable to verify admin user by email.", error);
    return null;
  }

  return data ? mapAdminUser(data as AdminUserRow) : null;
}