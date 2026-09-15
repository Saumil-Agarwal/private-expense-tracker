import { NextResponse } from "next/server";
import { z } from "zod";

import { PAYMENT_SOURCES } from "@/domain/reconciliation";
import { getLocalOwnerContext } from "@/server/local-owner";

const sourceKeys = PAYMENT_SOURCES.map((source) => source.key) as [string, ...string[]];
const UpdateSource = z.object({ sourceKey: z.enum(sourceKeys), enteredThrough: z.iso.date().nullable() });
const MarkInformed = z.object({ personId: z.uuid() });

export async function GET() {
  try {
    const { userId, supabase } = await getLocalOwnerContext();
    const [progress, notifications] = await Promise.all([
      supabase.from("payment_source_progress").select("source_key,entered_through").eq("user_id", userId),
      supabase.from("participant_notifications").select("person_id,informed_at").eq("user_id", userId),
    ]);
    if (progress.error) throw progress.error;
    if (notifications.error) throw notifications.error;
    return NextResponse.json({
      sourceProgress: (progress.data ?? []).map((row) => ({ sourceKey: row.source_key, enteredThrough: row.entered_through })),
      participantNotifications: notifications.data ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load reconciliation progress" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const parsed = UpdateSource.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment source progress" }, { status: 400 });
  try {
    const { userId, supabase } = await getLocalOwnerContext();
    const { error } = await supabase.from("payment_source_progress").upsert({
      user_id: userId, source_key: parsed.data.sourceKey, entered_through: parsed.data.enteredThrough,
    }, { onConflict: "user_id,source_key" });
    if (error) throw error;
    return NextResponse.json({ sourceKey: parsed.data.sourceKey, enteredThrough: parsed.data.enteredThrough });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save payment source progress" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = MarkInformed.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid participant" }, { status: 400 });
  try {
    const { userId, supabase } = await getLocalOwnerContext();
    const informedAt = new Date().toISOString();
    const { error } = await supabase.from("participant_notifications").upsert({
      user_id: userId, person_id: parsed.data.personId, informed_at: informedAt,
    }, { onConflict: "user_id,person_id" });
    if (error) throw error;
    return NextResponse.json({ personId: parsed.data.personId, informedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to mark participant informed" }, { status: 500 });
  }
}
