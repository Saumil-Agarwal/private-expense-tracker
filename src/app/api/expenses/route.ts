import { NextResponse } from "next/server";

import { ConfirmedExpenseSchema } from "@/domain/expense";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authenticateTelegramRequest } from "@/server/auth";
import { toTransactionInsert } from "@/server/ledger";

async function owner(request: Request) {
  const telegramId = authenticateTelegramRequest(request);
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("id").eq("telegram_user_id", telegramId).single();
  if (error || !data) throw new Error("Owner profile is not configured");
  return { userId: data.id as string, supabase };
}

export async function POST(request: Request) {
  try {
    const expense = ConfirmedExpenseSchema.parse(await request.json());
    const { userId, supabase } = await owner(request);
    let categoryId: string | null = null;
    if (expense.category) {
      const { data, error } = await supabase.from("categories").upsert({ user_id: userId, name: expense.category }, { onConflict: "user_id,name" }).select("id").single();
      if (error) throw error; categoryId = data.id as string;
    }
    const { data: transaction, error } = await supabase.from("transactions").insert({ ...toTransactionInsert(userId, expense), category_id: categoryId }).select("id").single();
    if (error || !transaction) throw error ?? new Error("Transaction was not created");
    if (expense.allocations.length) {
      const { data: me } = await supabase.from("people").upsert({ user_id: userId, name: "Me", is_owner: true }, { onConflict: "user_id,name" }).select("id").single();
      const rows = expense.allocations.map((allocation) => ({ user_id: userId, transaction_id: transaction.id, person_id: allocation.personId === "me" ? me?.id : allocation.personId, amount_paise: allocation.amountPaise }));
      const { error: allocationError } = await supabase.from("allocations").insert(rows);
      if (allocationError) { await supabase.from("transactions").delete().eq("id", transaction.id); throw allocationError; }
    }
    return NextResponse.json({ id: transaction.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid expense";
    const status = /Telegram|allowed|identity|Unauthorized/.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const { userId, supabase } = await owner(request);
    const { data, error } = await supabase.from("transactions").select("id,occurred_on,merchant,amount_paise,status,categories(name)").eq("user_id", userId).order("occurred_on", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ transactions: data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 }); }
}
