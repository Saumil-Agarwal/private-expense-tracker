"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { formatInr } from "@/domain/expense";

type Transaction = { id: string; occurred_on: string; merchant: string; amount_paise: number; status: "confirmed" | "needs_review"; categories?: { name: string } | null };

export function LedgerView({ summary = false }: { summary?: boolean }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData ?? "";
    fetch("/api/expenses", { headers: { "x-telegram-init-data": initData } })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).error ?? "Unable to load ledger"); return response.json(); })
      .then((body) => setTransactions(body.transactions))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);
  const total = useMemo(() => transactions.reduce((sum, item) => sum + item.amount_paise, 0), [transactions]);
  const unresolved = transactions.filter((item) => item.status === "needs_review");
  if (loading) return <div className="empty-state"><LoaderCircle className="spin" />Loading your ledger…</div>;
  if (error) return <div className="empty-state"><AlertCircle />{error}<small>Open this page from your Telegram bot after setup.</small></div>;
  if (summary) return <div className="summary-grid"><article><span>Total recorded</span><strong>{formatInr(total)}</strong></article><article><span>Transactions</span><strong>{transactions.length}</strong></article><article className="attention"><span>Needs review</span><strong>{unresolved.length}</strong><small>{formatInr(unresolved.reduce((sum, item) => sum + item.amount_paise, 0))}</small></article></div>;
  return <div className="transaction-list">{transactions.length === 0 ? <div className="empty-state">No expenses yet.</div> : transactions.map((item) => <article key={item.id}><div><strong>{item.merchant}</strong><span>{item.categories?.name ?? "Uncategorized"} · {new Date(`${item.occurred_on}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div><div className="transaction-amount"><strong>{formatInr(item.amount_paise)}</strong>{item.status === "needs_review" && <span>Needs review</span>}</div></article>)}</div>;
}
