"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatInr } from "@/domain/expense";

type Expense = {
  id: string;
  occurred_on: string;
  merchant: string;
  amount_paise: number;
  currency: string;
  status: string;
  notes: string | null;
  source: string;
  deleted_at: string | null;
  categories?: { name: string } | null;
  groups?: { id: string; name: string } | null;
  items: Array<{ id: string; name: string; quantity: number; amount_paise: number; owner: string | null }>;
  allocations: Array<{ person: string; amount_paise: number }>;
};

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function ExpenseDetail({ id }: { id: string }) {
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/expenses/${id}`);
        if (!response.ok) throw new Error(await responseError(response, "Unable to load expense"));
        const body = await response.json() as { expense: Expense };
        if (active) setExpense(body.expense);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load expense");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  async function update(action: "trash" | "restore") {
    if (action === "trash" && !window.confirm("Move this expense to Trash?")) return;
    setActing(true); setError("");
    try {
      const response = await fetch(`/api/expenses/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (!response.ok) throw new Error(await responseError(response, "Unable to update expense"));
      router.push(action === "trash" ? "/expenses" : "/expenses/trash");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update expense");
      setActing(false);
    }
  }

  async function permanentlyDelete() {
    if (!window.confirm("Delete this expense permanently? This cannot be undone.")) return;
    setActing(true); setError("");
    try {
      const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "Unable to delete expense"));
      router.push("/expenses/trash");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete expense");
      setActing(false);
    }
  }

  if (loading) return <div className="empty-state"><LoaderCircle className="spin" />Loading expense…</div>;
  if (!expense) return <div className="empty-state"><AlertCircle />{error || "Expense not found"}</div>;

  return <div className="expense-detail">
    {expense.deleted_at && <div className="trash-notice">This expense is in Trash.</div>}
    <section className="detail-hero"><div><p className="eyebrow">{expense.categories?.name ?? "Uncategorized"}</p><h2>{expense.merchant}</h2><p>{new Date(`${expense.occurred_on}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "long" })}{expense.groups?.name ? ` · ${expense.groups.name}` : ""}</p></div><strong>{formatInr(expense.amount_paise)}</strong></section>
    <section className="detail-card"><h3>Details</h3><dl><div><dt>Status</dt><dd>{expense.status.replaceAll("_", " ")}</dd></div><div><dt>Source</dt><dd>{expense.source.replaceAll("_", " ")}</dd></div><div><dt>Currency</dt><dd>{expense.currency}</dd></div><div><dt>Notes</dt><dd>{expense.notes || "No notes"}</dd></div></dl></section>
    <section className="detail-card"><h3>Items</h3>{expense.items.length ? <ul className="detail-list">{expense.items.map((item) => <li key={item.id}><span><strong>{item.name}</strong><small>{item.quantity} ×{item.owner ? ` · ${item.owner}` : ""}</small></span><strong>{formatInr(item.amount_paise)}</strong></li>)}</ul> : <p className="muted">No item details recorded.</p>}</section>
    <section className="detail-card"><h3>Split</h3>{expense.allocations.length ? <ul className="allocation-list">{expense.allocations.map((allocation) => <li key={allocation.person}><span>{allocation.person}</span><strong>{formatInr(allocation.amount_paise)}</strong></li>)}</ul> : <p className="muted">No shares assigned.</p>}</section>
    {error && <p className="detail-error">{error}</p>}
    <div className="detail-actions">{expense.deleted_at ? <><button className="button-primary" disabled={acting} onClick={() => void update("restore")}>Restore expense</button><button className="button-danger" disabled={acting} onClick={() => void permanentlyDelete()}>Delete permanently</button></> : <button className="button-quiet" disabled={acting} onClick={() => void update("trash")}>Move to Trash</button>}</div>
  </div>;
}
