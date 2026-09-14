import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.EXPENSES_NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.EXPENSES_SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase server environment is not configured");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
