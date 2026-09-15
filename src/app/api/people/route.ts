import { NextResponse } from "next/server";
import { z } from "zod";

import { getLocalOwnerContext } from "@/server/local-owner";

const CreatePerson = z.object({ name: z.string().trim().min(1).max(80) });

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

export async function POST(request: Request) {
  const parsed = CreatePerson.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a person name" }, { status: 400 });
  try {
    const { userId, supabase } = await getLocalOwnerContext();
    const name = parsed.data.name;
    const { data: existing, error: existingError } = await supabase
      .from("people")
      .select("id,name,is_owner,is_active")
      .eq("user_id", userId)
      .ilike("name", name)
      .maybeSingle();
    if (existingError) throw existingError;

    type PersonRow = { id: string; name: string; is_owner: boolean; is_active: boolean };
    let person = existing as PersonRow | null;
    if (person && !person.is_active) {
      const { data, error } = await supabase.from("people").update({ is_active: true }).eq("id", person.id).select("id,name,is_owner,is_active").single();
      if (error || !data) throw error ?? new Error("Person could not be restored");
      person = data as PersonRow;
    }
    if (!person) {
      const { data, error } = await supabase.from("people").insert({ user_id: userId, name, is_owner: false, is_active: true }).select("id,name,is_owner,is_active").single();
      if (error || !data) throw error ?? new Error("Person could not be saved");
      person = data as PersonRow;
    }
    return NextResponse.json({ person: { id: person.is_owner ? "me" : person.id, persistedId: person.id, name: person.name } }, { status: existing ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save person" }, { status: 500 });
  }
}
