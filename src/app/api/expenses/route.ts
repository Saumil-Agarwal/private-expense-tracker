import { NextResponse } from "next/server";

import { ConfirmedExpenseSchema } from "@/domain/expense";
import { toTransactionInsert } from "@/server/ledger";
import { getLocalOwnerContext } from "@/server/local-owner";

export async function POST(request: Request) {
  let expense: ReturnType<typeof ConfirmedExpenseSchema.parse>;
  let createdTransaction: { id: string; supabase: Awaited<ReturnType<typeof getLocalOwnerContext>>["supabase"] } | null = null;
  try {
    const parsed = ConfirmedExpenseSchema.safeParse(await request.json());
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      if (fieldErrors.merchant) fieldErrors.merchant = ["Enter a merchant name"];
      return NextResponse.json({ error: "Invalid expense details", fieldErrors }, { status: 400 });
    }
    expense = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid expense details" }, { status: 400 });
  }
  try {
    const { userId, supabase } = await getLocalOwnerContext();
    let categoryId: string | null = null;
    if (expense.category) {
      const { data, error } = await supabase.from("categories").upsert({ user_id: userId, name: expense.category }, { onConflict: "user_id,name" }).select("id").single();
      if (error) throw error; categoryId = data.id as string;
    }
    const { data: transaction, error } = await supabase.from("transactions").insert({ ...toTransactionInsert(userId, expense), category_id: categoryId }).select("id").single();
    if (error || !transaction) throw error ?? new Error("Transaction was not created");
    createdTransaction = { id: transaction.id as string, supabase };
    if (expense.allocations.length) {
      const { data: me } = await supabase.from("people").upsert({ user_id: userId, name: "Me", is_owner: true }, { onConflict: "user_id,name" }).select("id").single();
      const participantIds = new Map<string, string>();
      if (me?.id) participantIds.set("me", me.id as string);
      for (const allocation of expense.allocations.filter((item) => item.personId.startsWith("name:"))) {
        const name = allocation.personId.slice(5);
        const { data: person, error: personError } = await supabase.from("people").upsert({ user_id: userId, name }, { onConflict: "user_id,name" }).select("id").single();
        if (personError || !person) throw personError ?? new Error("Participant could not be saved");
        participantIds.set(allocation.personId, person.id as string);
      }
      const rows = expense.allocations.map((allocation) => ({ user_id: userId, transaction_id: transaction.id, person_id: participantIds.get(allocation.personId) ?? allocation.personId, amount_paise: allocation.amountPaise }));
      const { error: allocationError } = await supabase.from("allocations").insert(rows);
      if (allocationError) throw allocationError;
    }
    return NextResponse.json({ id: transaction.id }, { status: 201 });
  } catch (error) {
    if (createdTransaction) await createdTransaction.supabase.from("transactions").delete().eq("id", createdTransaction.id);
    const message = error instanceof Error ? error.message : "Invalid expense";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { userId, supabase } = await getLocalOwnerContext();
    const url = new URL(request.url);
    let query = supabase.from("transactions").select("id,occurred_on,merchant,amount_paise,status,categories(name),groups(id,name),allocations(amount_paise,people(name))").eq("user_id", userId);
    const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
    if (from) query = query.gte("occurred_on", from);
    if (to) query = query.lte("occurred_on", to);
    query = query.order("occurred_on", { ascending: false });
    if (!from && !to) query = query.limit(100);
    const { data, error } = await query;
    if (error) throw error;
    type TransactionRow = { allocations?: Array<{ amount_paise: number; people?: { name: string } | null }>; [key: string]: unknown };
    return NextResponse.json({ transactions: ((data ?? []) as unknown as TransactionRow[]).map((transaction) => ({ ...transaction, allocations: (transaction.allocations ?? []).map((allocation) => ({ person: allocation.people?.name ?? "Unknown", amount_paise: allocation.amount_paise })) })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load ledger" }, { status: 500 }); }
}
