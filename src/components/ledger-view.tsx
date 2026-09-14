"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, LoaderCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatInr } from "@/domain/expense";
import { calculateSummary } from "@/domain/summary";

type Transaction = { id: string; occurred_on: string; created_at: string; merchant: string; amount_paise: number; status: "confirmed" | "needs_review"; categories?: { name: string } | null; groups?: { id: string; name: string } | null; allocations: Array<{ person: string; amount_paise: number }> };
function isoToday() { return new Date().toISOString().slice(0, 10); }

export function LedgerView({ summary = false, trash = false }: { summary?: boolean; trash?: boolean }) {
  const today = isoToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`); const [to, setTo] = useState(today);
  const [transactions, setTransactions] = useState<Transaction[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = summary ? `?from=${from}&to=${to}` : trash ? "?trash=true" : "";
      const response = await fetch(`/api/expenses${params}`);
      if (!response.ok) throw new Error((await response.json()).error ?? "Unable to load ledger");
      setTransactions((await response.json()).transactions);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load ledger"); }
    finally { setLoading(false); }
  }, [from, summary, to, trash]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => calculateSummary(transactions), [transactions]);
  async function moveToTrash(transaction: Transaction) {
    if (!window.confirm(`Move ${transaction.merchant} to Trash? It will be deducted from your totals.`)) return;
    setActingId(transaction.id); setError("");
    try {
      const response = await fetch(`/api/expenses/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "trash" }) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Unable to move expense to Trash");
      setTransactions((current) => current.filter((item) => item.id !== transaction.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to move expense to Trash");
    } finally {
      setActingId(null);
    }
  }
  if (loading) return <div className="empty-state"><LoaderCircle className="spin" />Loading your ledger…</div>;
  if (error) return <div className="empty-state"><AlertCircle />{error}</div>;
  if (summary) return <div className="summary-content">
    <div className="date-filter"><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
    <div className="summary-grid"><article><span>Final total</span><strong>{formatInr(totals.finalTotalPaise)}</strong><small>{from} to {to}</small></article><article><span>Expenses</span><strong>{transactions.length}</strong></article><article className="attention"><span>Needs review</span><strong>{totals.unresolved.count}</strong><small>{formatInr(totals.unresolved.amountPaise)}</small></article></div>
    <section className={`insight-card ${totals.balanced ? "" : "attention"}`}><p className="eyebrow">Reconciliation</p><h2>{totals.balanced ? "All totals verified" : "Totals need attention"}</h2><p>{formatInr(totals.confirmedTotalPaise)} confirmed + {formatInr(totals.unresolved.amountPaise)} unresolved = {formatInr(totals.finalTotalPaise)} recorded</p><p>{formatInr(totals.participantTotalPaise)} assigned to participants</p></section>
    <section className="insight-card"><p className="eyebrow">Share of each</p>{totals.participantTotals.length ? <ul className="allocation-list">{totals.participantTotals.map((item) => <li key={item.person}><span>{item.person}</span><strong>{formatInr(item.amountPaise)}</strong></li>)}</ul> : <p>No confirmed shares in these dates.</p>}</section>
    <section className="workings-card"><h2>Workings</h2>{transactions.map((transaction) => { const working = totals.workings.find((item) => item.id === transaction.id)!; return <Link aria-label={`View ${transaction.merchant}`} className="working-link" href={`/expenses/${transaction.id}`} key={transaction.id}><article><div><strong>{transaction.merchant}</strong><span>{transaction.occurred_on}{transaction.groups?.name ? ` · ${transaction.groups.name}` : ""}</span></div><strong>{formatInr(transaction.amount_paise)}</strong><p>{transaction.allocations.length ? transaction.allocations.map((allocation) => `${allocation.person} ${formatInr(allocation.amount_paise)}`).join(" + ") : "Unresolved — no shares assigned"}</p>{transaction.status === "confirmed" && <small>{working.balanced ? "Verified" : `Mismatch by ${formatInr(Math.abs(working.differencePaise))}`}</small>}</article></Link>; })}</section>
  </div>;
  return <div className="transaction-list">{transactions.length === 0 ? <div className="empty-state">{trash ? "Trash is empty." : "No expenses yet."}</div> : transactions.map((item) => <article key={item.id}><Link aria-label={`View ${item.merchant}`} className="transaction-link" href={`/expenses/${item.id}`}><div><strong>{item.merchant}</strong><span>{item.categories?.name ?? "Uncategorized"} · {new Date(`${item.occurred_on}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div><div className="transaction-amount"><strong>{formatInr(item.amount_paise)}</strong>{item.status === "needs_review" && <span>Needs review</span>}</div></Link>{!trash && <button className="transaction-delete" type="button" aria-label={`Delete ${item.merchant}`} disabled={actingId === item.id} onClick={() => void moveToTrash(item)}>{actingId === item.id ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}</button>}</article>)}</div>;
}
