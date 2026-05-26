const PLACEHOLDER_VALUES = new Set([
  "",
  "your_supabase_url_here",
  "your_supabase_anon_key_here",
  "your_supabase_service_role_key_here",
]);

// Next.js inlines NEXT_PUBLIC_* env vars at build time ONLY when accessed
// via literal property names. Dynamic access (process.env[name]) returns
// undefined on the client. Use literal access for all public env vars.
function getPublicUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
}

function getPublicAnonKey() {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}

function getServiceRoleKeyRaw() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

function isConfiguredValue(value: string) {
  return Boolean(value) && !PLACEHOLDER_VALUES.has(value);
}

export function isSupabaseConfigured() {
  return (
    isConfiguredValue(getPublicUrl()) &&
    isConfiguredValue(getPublicAnonKey())
  );
}

export function getSupabaseUrl() {
  const value = getPublicUrl();
  if (!isConfiguredValue(value)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing or still set to a placeholder value.");
  }
  return value;
}

export function getSupabaseAnonKey() {
  const value = getPublicAnonKey();
  if (!isConfiguredValue(value)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or still set to a placeholder value.");
  }
  return value;
}

export function getSupabaseServiceRoleKey() {
  const serviceRole = getServiceRoleKeyRaw();
  if (isConfiguredValue(serviceRole)) {
    return serviceRole;
  }

  return getSupabaseAnonKey();
}

export function getSupabaseConfigSummary() {
  return {
    hasUrl: isConfiguredValue(getPublicUrl()),
    hasAnonKey: isConfiguredValue(getPublicAnonKey()),
    hasServiceRoleKey: isConfiguredValue(getServiceRoleKeyRaw()),
  };
}

export function getSupabaseSetupMessage() {
  return "Supabase is not configured. Update .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY, then restart npm run dev.";
}
