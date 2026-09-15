import { personNameKey } from "./person";

export const PAYMENT_SOURCES = [
  { key: "cash", name: "Cash" },
  { key: "axis-7461", name: "Axis Account 7461" },
  { key: "axis-1177", name: "Axis Account 1177" },
  { key: "axis-my-zone", name: "Axis Cred Card My Zone" },
  { key: "axis-select", name: "Axis Cred Card Select" },
  { key: "icici-amazon", name: "ICICI Amazon Cred Card" },
  { key: "icici-sapphiro", name: "ICICI Saphhiro Card" },
  { key: "splitwise", name: "Splitwise" },
  { key: "amazon-pay", name: "Amazon Pay balance" },
  { key: "uber-points", name: "Uber points" },
] as const;

export type SourceProgress = { key: string; enteredThrough: string | null };

export function calculateCommonThroughDate(progress: SourceProgress[]) {
  if (!progress.length || progress.some((source) => !source.enteredThrough)) return null;
  return progress.reduce<string>((earliest, source) => source.enteredThrough! < earliest ? source.enteredThrough! : earliest, progress[0].enteredThrough!);
}

type ReconciliationTransaction = {
  id: string;
  created_at: string;
  occurred_on: string;
  status: "confirmed" | "needs_review";
  allocations: Array<{ personId?: string; person: string; amount_paise: number }>;
};

export function calculateOutstandingShares(transactions: ReconciliationTransaction[], informedAtByPerson: Record<string, string>) {
  const totals = new Map<string, { personId: string; person: string; amountPaise: number }>();
  for (const transaction of transactions) {
    if (transaction.status !== "confirmed") continue;
    for (const allocation of transaction.allocations) {
      const personId = allocation.personId ?? personNameKey(allocation.person);
      const informedAt = informedAtByPerson[personId];
      if (informedAt && transaction.created_at <= informedAt) continue;
      const current = totals.get(personId);
      totals.set(personId, {
        personId,
        person: current?.person ?? allocation.person.trim(),
        amountPaise: (current?.amountPaise ?? 0) + allocation.amount_paise,
      });
    }
  }
  return [...totals.values()].sort((a, b) => b.amountPaise - a.amountPaise || a.person.localeCompare(b.person));
}
