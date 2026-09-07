import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authenticateOwnerRequest } from "@/server/auth";

const CreateGroup = z.object({ name: z.string().trim().min(1).max(80), memberNames: z.array(z.string().trim().min(1).max(80)).min(1) });

async function context(request: Request) {
  const telegramId = authenticateOwnerRequest(request);
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").upsert({ telegram_user_id: telegramId, display_name: "Owner" }, { onConflict: "telegram_user_id" }).select("id").single();
  if (error || !data) throw error ?? new Error("Owner profile is not configured");
  return { userId: data.id as string, supabase };
}

export async function GET(request: Request) {
  try {
    const { userId, supabase } = await context(request);
    const { data, error } = await supabase.from("groups").select("id,name,group_members(people(id,name,is_owner))").eq("user_id", userId).order("name");
    if (error) throw error;
    type GroupRow = { id: string; name: string; group_members?: Array<{ people: { id: string; name: string; is_owner: boolean } }> };
    const groups = ((data ?? []) as unknown as GroupRow[]).map((group) => ({ id: group.id, name: group.name, people: (group.group_members ?? []).map((member) => ({ id: member.people.is_owner ? "me" : member.people.id, persistedId: member.people.id, name: member.people.name })) }));
    return NextResponse.json({ groups });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load groups" }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    const input = CreateGroup.parse(await request.json());
    const names = [...new Set(input.memberNames.map((name) => name.trim()))];
    const { userId, supabase } = await context(request);
    const { data: group, error: groupError } = await supabase.from("groups").insert({ user_id: userId, name: input.name }).select("id,name").single();
    if (groupError || !group) throw groupError ?? new Error("Group was not created");
    const people: Array<{ id: string; name: string; is_owner: boolean }> = [];
    for (const name of names) {
      const isOwner = name.toLowerCase() === "me";
      const { data: person, error } = await supabase.from("people").upsert({ user_id: userId, name: isOwner ? "Me" : name, is_owner: isOwner }, { onConflict: "user_id,name" }).select("id,name,is_owner").single();
      if (error || !person) throw error ?? new Error("Group member was not created");
      people.push(person);
    }
    const { error: memberError } = await supabase.from("group_members").insert(people.map((person) => ({ user_id: userId, group_id: group.id, person_id: person.id })));
    if (memberError) throw memberError;
    return NextResponse.json({ group: { id: group.id, name: group.name, people: people.map((person) => ({ id: person.is_owner ? "me" : person.id, persistedId: person.id, name: person.name })) } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create group" }, { status: /session|Telegram|authentication/i.test(String(error)) ? 401 : 400 }); }
}
