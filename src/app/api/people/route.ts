import { NextResponse } from "next/server";

import { getLocalOwnerContext } from "@/server/local-owner";

export async function GET() {
  try {
    const { userId, supabase } = await getLocalOwnerContext();
    const { data, error } = await supabase.from("people").select("id,name,is_owner").eq("user_id", userId).eq("is_active", true).order("name");
    if (error) throw error;
    type PersonRow = { id: string; name: string; is_owner: boolean };
    const people = ((data ?? []) as PersonRow[]).map((person) => ({
      id: person.is_owner ? "me" : person.id,
      persistedId: person.id,
      name: person.name,
    }));
    return NextResponse.json({ people });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load people" }, { status: 500 });
  }
}
