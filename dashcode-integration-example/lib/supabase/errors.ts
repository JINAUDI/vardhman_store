type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

export function getSupabaseProductsTableMessage() {
  return "Supabase table public.products is not available. Create the products table in the public schema, or confirm the table name and API exposure in Supabase.";
}

export function getSupabaseTableMessage(tableName: string) {
  return `Supabase table public.${tableName} is not available. Run the catalog schema SQL in Supabase, then refresh the app.`;
}

export function getReadableSupabaseErrorMessage(
  error: unknown,
  fallback: string
) {
  const candidate = error as SupabaseErrorLike | null;
  const message = candidate?.message || "";

  const missingTableMatch = message.match(/'public\.([a-zA-Z0-9_]+)'/);
  if (candidate?.code === "PGRST205" && missingTableMatch?.[1]) {
    return getSupabaseTableMessage(missingTableMatch[1]);
  }

  if (message.includes("public.products")) {
    return getSupabaseProductsTableMessage();
  }

  return message || fallback;
}
