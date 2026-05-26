import "server-only";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveAdminUser } from "@/lib/supabase/admin-auth";

export const ADMIN_AUTH_COOKIE_NAME = "dashcode_admin_access_token";

export type SupabaseAdminSession = {
  id: string;
  email: string;
  name: string;
  image: string;
  role: string;
  phone: string;
  jobTitle: string;
  location: string;
  bio: string;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  return String(metadata[key] || "").trim();
}

function getDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string | null }) {
  const metadata = user.user_metadata || {};
  return String(metadata.full_name || metadata.name || user.email || "Admin");
}

export async function getSupabaseAdminSession(): Promise<SupabaseAdminSession | null> {
  try {
    const accessToken = cookies().get(ADMIN_AUTH_COOKIE_NAME)?.value;

    if (!accessToken) {
      return null;
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      return null;
    }

    const adminUser = await getActiveAdminUser(data.user.id, data.user.email);

    if (!adminUser) {
      return null;
    }

    const metadata = data.user.user_metadata || {};

    return {
      id: data.user.id,
      email: normalizeEmail(data.user.email),
      name: getDisplayName(data.user),
      image: String(data.user.user_metadata?.avatar_url || "/images/avatar/avatar-1.png"),
      role: adminUser.role,
      phone: metadataString(metadata, "phone"),
      jobTitle: metadataString(metadata, "job_title"),
      location: metadataString(metadata, "location"),
      bio: metadataString(metadata, "bio"),
    };
  } catch (error) {
    console.warn("[auth] Unable to load Supabase admin session.", error);
    return null;
  }
}
