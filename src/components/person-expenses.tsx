"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import Link from "next/link";

import { formatInr } from "@/domain/expense";
import { personNameKey } from "@/domain/person";

type Transaction = {
  id: string;
  occurred_on: string;
  merchant: string;
  amount_paise: number;
  groups?: { id: string; name: string } | null;
  allocations: Array<{ person: string; amount_paise: number }>;
};

function isoToday() { return new Date().toISOString().slice(0, 10); }

export function PersonExpenses({ person }: { person: string }) {
  const today = isoToday();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/expenses?from=${from}&to=${to}`);
      if (!response.ok) throw new Error((await response.json()).error ?? "Unable to load expenses");
      setTransactions((await response.json()).transactions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load expenses");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const expenses = useMemo(() => {
    const key = personNameKey(person);
    return transactions.flatMap((transaction) => {
      const sharePaise = transaction.allocations
        .filter((allocation) => personNameKey(allocation.person) === key)
        .reduce((total, allocation) => total + allocation.amount_paise, 0);
      return sharePaise ? [{ transaction, sharePaise }] : [];
    });
  }, [person, transactions]);
  const totalPaise = expenses.reduce((total, expense) => total + expense.sharePaise, 0);

  return <div className="summary-content">
    <div className="date-filter"><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
    {loading ? <div className="empty-state"><LoaderCircle className="spin" />Loading {person}&apos;s expenses…</div>
      : error ? <div className="empty-state"><AlertCircle />{error}</div>
      : <>
        <div className="summary-grid person-summary-grid"><article><span>Total share</span><strong>{formatInr(totalPaise)}</strong><small>{from} to {to}</small></article><article><span>Expenses</span><strong>{expenses.length}</strong><small>{expenses.length === 1 ? "1 expense" : `${expenses.length} expenses`}</small></article></div>
        {expenses.length ? <section className="workings-card person-expense-list"><h2>Expenses</h2>{expenses.map(({ transaction, sharePaise }) => <Link aria-label={`View ${transaction.merchant}`} className="working-link" href={`/expenses/${transaction.id}`} key={transaction.id}><article><div><strong>{transaction.merchant}</strong><span>{transaction.occurred_on}{transaction.groups?.name ? ` · ${transaction.groups.name}` : ""}</span></div><strong>{formatInr(sharePaise)}</strong><p>Your share {formatInr(sharePaise)} · Full amount {formatInr(transaction.amount_paise)}</p></article></Link>)}</section>
          : <div className="empty-state">No expenses for {person} in these dates.</div>}
      </>}
  </div>;
}
