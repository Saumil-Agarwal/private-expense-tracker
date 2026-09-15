import { NextResponse } from "next/server";

import { ConfirmedExpenseSchema } from "@/domain/expense";
import { getLocalOwnerContext } from "@/server/local-owner";

type RouteContext = { params: Promise<{ id: string }> };

const detailSelection = "id,occurred_on,merchant,amount_paise,currency,status,notes,source,deleted_at,categories(name),groups(id,name),allocations(amount_paise,person_id,people(id,name)),transaction_items(id,name,quantity,amount_paise,owner_person_id,people(id,name))";

function failure(error: unknown, fallback: string) {
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const [{ id }, { userId, supabase }] = await Promise.all([context.params, getLocalOwnerContext()]);
    const { data, error } = await supabase.from("transactions").select(detailSelection).eq("id", id).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    const row = data as unknown as {
      allocations?: Array<{ amount_paise: number; person_id: string; people?: { id: string; name: string } | null }>;
      transaction_items?: Array<{ id: string; name: string; quantity: number; amount_paise: number; owner_person_id: string | null; people?: { id: string; name: string } | null }>;
      [key: string]: unknown;
    };
    return NextResponse.json({ expense: {
      ...row,
      allocations: (row.allocations ?? []).map((allocation) => ({ personId: allocation.person_id, person: allocation.people?.name ?? "Unknown", amount_paise: allocation.amount_paise })),
      items: (row.transaction_items ?? []).map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, amount_paise: item.amount_paise, owner_person_id: item.owner_person_id, owner: item.people?.name ?? null })),
      transaction_items: undefined,
    } });
  } catch (error) {
    return failure(error, "Unable to load expense");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const [{ id }, { userId, supabase }] = await Promise.all([context.params, getLocalOwnerContext()]);
    if (body?.action === "trash" || body?.action === "restore") {
      const deletedAt = body.action === "trash" ? new Date().toISOString() : null;
      const { data, error } = await supabase.from("transactions").update({ deleted_at: deletedAt }).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
      return NextResponse.json({ id: data.id, deleted_at: deletedAt });
    }
    const parsed = ConfirmedExpenseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid expense details", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { data, error } = await supabase.rpc("update_expense", { p_transaction_id: id, p_user_id: userId, p_expense: parsed.data });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    return NextResponse.json({ id: data });
  } catch (error) {
    return failure(error, "Unable to update expense");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const [{ id }, { userId, supabase }] = await Promise.all([context.params, getLocalOwnerContext()]);
    const { data, error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", userId).not("deleted_at", "is", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Trashed expense not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error, "Unable to delete expense");
  }
}
