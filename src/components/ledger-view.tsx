"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, LoaderCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatInr } from "@/domain/expense";
import { calculateSummary } from "@/domain/summary";
import { calculateCommonThroughDate, calculateOutstandingShares, PAYMENT_SOURCES } from "@/domain/reconciliation";

type Transaction = { id: string; occurred_on: string; created_at: string; merchant: string; amount_paise: number; status: "confirmed" | "needs_review"; categories?: { name: string } | null; groups?: { id: string; name: string } | null; allocations: Array<{ personId?: string; person: string; amount_paise: number }> };
function isoToday() { return new Date().toISOString().slice(0, 10); }

export function LedgerView({ summary = false, trash = false }: { summary?: boolean; trash?: boolean }) {
  const today = isoToday();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`); const [to, setTo] = useState(today);
  const [transactions, setTransactions] = useState<Transaction[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [sourceProgress, setSourceProgress] = useState<Record<string, string>>({});
  const [informedAt, setInformedAt] = useState<Record<string, string>>({});
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
  const outstandingShares = useMemo(() => calculateOutstandingShares(transactions, informedAt), [informedAt, transactions]);
  const commonThrough = useMemo(() => calculateCommonThroughDate(PAYMENT_SOURCES.map((source) => ({ key: source.key, enteredThrough: sourceProgress[source.key] || null }))), [sourceProgress]);
  useEffect(() => {
    if (!summary) return;
    void fetch("/api/reconciliation").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load reconciliation progress");
      const payload = await response.json();
      setSourceProgress(Object.fromEntries((payload.sourceProgress ?? []).map((item: { sourceKey: string; enteredThrough: string | null }) => [item.sourceKey, item.enteredThrough ?? ""])));
      setInformedAt(Object.fromEntries((payload.participantNotifications ?? []).map((item: { person_id: string; informed_at: string }) => [item.person_id, item.informed_at])));
    }).catch(() => undefined);
  }, [summary]);
  async function saveSourceProgress(sourceKey: string, enteredThrough: string) {
    setSourceProgress((current) => ({ ...current, [sourceKey]: enteredThrough }));
    const response = await fetch("/api/reconciliation", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceKey, enteredThrough: enteredThrough || null }) });
    if (!response.ok) { setError((await response.json()).error ?? "Unable to save progress"); await load(); }
  }
  async function markInformed(personId: string) {
    setActingId(personId); setError("");
    try {
      const response = await fetch("/api/reconciliation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ personId }) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Unable to mark participant informed");
      const payload = await response.json();
      setInformedAt((current) => ({ ...current, [personId]: payload.informedAt }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to mark participant informed"); }
    finally { setActingId(null); }
  }
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
    <section className="insight-card ledger-progress-card"><p className="eyebrow">Ledger progress</p><h2>{commonThrough ? `Caught up through ${commonThrough}` : "Finish every payment source"}</h2><div className="source-progress-list">{PAYMENT_SOURCES.map((source) => <label key={source.key}><span>{source.name}</span><input aria-label={`${source.name} entered through`} type="date" value={sourceProgress[source.key] ?? ""} onChange={(event) => void saveSourceProgress(source.key, event.target.value)} /></label>)}</div></section>
    <section className="insight-card"><p className="eyebrow">Share of each</p>{outstandingShares.length ? <ul className="allocation-list participant-summary-list">{outstandingShares.map((item) => <li key={item.personId}><Link href={`/people/${encodeURIComponent(item.person)}`}><span>{item.person}</span><strong>{formatInr(item.amountPaise)}</strong></Link><button type="button" disabled={actingId === item.personId} aria-label={`Mark ${item.person} informed`} onClick={() => void markInformed(item.personId)}>{actingId === item.personId ? <LoaderCircle className="spin" size={16} /> : "Informed"}</button></li>)}</ul> : <p>No new shares to communicate in these dates.</p>}</section>
    <section className="workings-card"><h2>Workings</h2>{transactions.map((transaction) => { const working = totals.workings.find((item) => item.id === transaction.id)!; return <Link aria-label={`View ${transaction.merchant}`} className="working-link" href={`/expenses/${transaction.id}`} key={transaction.id}><article><div><strong>{transaction.merchant}</strong><span>{transaction.occurred_on}{transaction.groups?.name ? ` · ${transaction.groups.name}` : ""}</span></div><strong>{formatInr(transaction.amount_paise)}</strong><p>{transaction.allocations.length ? transaction.allocations.map((allocation) => `${allocation.person} ${formatInr(allocation.amount_paise)}`).join(" + ") : "Unresolved — no shares assigned"}</p>{transaction.status === "confirmed" && <small>{working.balanced ? "Verified" : `Mismatch by ${formatInr(Math.abs(working.differencePaise))}`}</small>}</article></Link>; })}</section>
  </div>;
  return <div className="transaction-list">{transactions.length === 0 ? <div className="empty-state">{trash ? "Trash is empty." : "No expenses yet."}</div> : transactions.map((item) => <article key={item.id}><Link aria-label={`View ${item.merchant}`} className="transaction-link" href={`/expenses/${item.id}`}><div><strong>{item.merchant}</strong><span>{item.categories?.name ?? "Uncategorized"} · {new Date(`${item.occurred_on}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div><div className="transaction-amount"><strong>{formatInr(item.amount_paise)}</strong>{item.status === "needs_review" && <span>Needs review</span>}</div></Link>{!trash && <button className="transaction-delete" type="button" aria-label={`Delete ${item.merchant}`} disabled={actingId === item.id} onClick={() => void moveToTrash(item)}>{actingId === item.id ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}</button>}</article>)}</div>;
}
