import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const LOCAL_OWNER_KEY = "local-owner";

async function readOwner(supabase: SupabaseClient) {
  return supabase.from("profiles").select("id").eq("profile_key", LOCAL_OWNER_KEY).maybeSingle();
}

export async function getLocalOwnerContext(supabase: SupabaseClient = createServerSupabaseClient()) {
  const existing = await readOwner(supabase);
  if (existing.error) throw new Error("Local owner profile could not be resolved");
  if (existing.data) return { userId: existing.data.id as string, supabase };

  const created = await supabase.from("profiles").insert({ profile_key: LOCAL_OWNER_KEY, display_name: "Owner" }).select("id").single();
  if (created.data) return { userId: created.data.id as string, supabase };
  if (created.error?.code === "23505") {
    const concurrent = await readOwner(supabase);
    if (concurrent.data && !concurrent.error) return { userId: concurrent.data.id as string, supabase };
  }
  throw new Error("Local owner profile could not be resolved");
}
