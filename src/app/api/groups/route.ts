import { NextResponse } from "next/server";
import { z } from "zod";
import { personNameKey } from "@/domain/person";
import { getLocalOwnerContext } from "@/server/local-owner";

const CreateGroup = z.object({ name: z.string().trim().min(1).max(80), memberNames: z.array(z.string().trim().min(1).max(80)).min(1) });

export async function GET() {
  try {
    const { userId, supabase } = await getLocalOwnerContext();
    const { data, error } = await supabase.from("groups").select("id,name,group_members(people(id,name,is_owner))").eq("user_id", userId).order("name");
    if (error) throw error;
    type GroupRow = { id: string; name: string; group_members?: Array<{ people: { id: string; name: string; is_owner: boolean } }> };
    const groups = ((data ?? []) as unknown as GroupRow[]).map((group) => ({ id: group.id, name: group.name, people: (group.group_members ?? []).map((member) => ({ id: member.people.is_owner ? "me" : member.people.id, persistedId: member.people.id, name: member.people.name })) }));
    return NextResponse.json({ groups });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load groups" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const parsed = CreateGroup.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid group details", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  let createdGroup: { id: string; supabase: Awaited<ReturnType<typeof getLocalOwnerContext>>["supabase"] } | null = null;
  try {
    const input = parsed.data;
    const namesByKey = new Map<string, string>();
    for (const name of input.memberNames) {
      const trimmed = name.trim();
      const key = trimmed.toLocaleLowerCase();
      if (!namesByKey.has(key)) namesByKey.set(key, trimmed);
    }
    const names = [...namesByKey.values()];
    const { userId, supabase } = await getLocalOwnerContext();
    const { data: group, error: groupError } = await supabase.from("groups").insert({ user_id: userId, name: input.name }).select("id,name").single();
    if (groupError || !group) throw groupError ?? new Error("Group was not created");
    createdGroup = { id: group.id as string, supabase };
    const { data: existingPeople, error: existingPeopleError } = await supabase.from("people").select("id,name,is_owner").eq("user_id", userId);
    if (existingPeopleError) throw existingPeopleError;
    type PersonRow = { id: string; name: string; is_owner: boolean };
    const peopleByName = new Map(((existingPeople ?? []) as PersonRow[]).map((person) => [personNameKey(person.name), person]));
    const people: Array<{ id: string; name: string; is_owner: boolean }> = [];
    for (const name of names) {
      const isOwner = name.toLowerCase() === "me";
      const key = personNameKey(name);
      let person = peopleByName.get(key);
      if (!person) {
        const { data, error } = await supabase.from("people").upsert({ user_id: userId, name: isOwner ? "Me" : name, is_owner: isOwner }, { onConflict: "user_id,name" }).select("id,name,is_owner").single();
        if (error || !data) throw error ?? new Error("Group member was not created");
        person = data as PersonRow;
        peopleByName.set(key, person);
      }
      people.push(person);
    }
    const { error: memberError } = await supabase.from("group_members").insert(people.map((person) => ({ user_id: userId, group_id: group.id, person_id: person.id })));
    if (memberError) throw memberError;
    return NextResponse.json({ group: { id: group.id, name: group.name, people: people.map((person) => ({ id: person.is_owner ? "me" : person.id, persistedId: person.id, name: person.name })) } }, { status: 201 });
  } catch (error) {
    if (createdGroup) await createdGroup.supabase.from("groups").delete().eq("id", createdGroup.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create group" }, { status: 500 });
  }
}
