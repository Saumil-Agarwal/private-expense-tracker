export type SummaryTransaction = {
  id: string;
  merchant: string;
  amount_paise: number;
  status: "confirmed" | "needs_review";
  allocations: Array<{ person: string; amount_paise: number }>;
};

export function calculateSummary(transactions: SummaryTransaction[]) {
  const totals = new Map<string, number>();
  let unresolvedCount = 0;
  let unresolvedAmount = 0;
  for (const transaction of transactions) {
    if (transaction.status === "needs_review") {
      unresolvedCount += 1;
      unresolvedAmount += transaction.amount_paise;
      continue;
    }
    for (const allocation of transaction.allocations) totals.set(allocation.person, (totals.get(allocation.person) ?? 0) + allocation.amount_paise);
  }
  return {
    finalTotalPaise: transactions.reduce((sum, transaction) => sum + transaction.amount_paise, 0),
    unresolved: { count: unresolvedCount, amountPaise: unresolvedAmount },
    participantTotals: [...totals].map(([person, amountPaise]) => ({ person, amountPaise })).sort((a, b) => b.amountPaise - a.amountPaise || a.person.localeCompare(b.person)),
    workings: transactions.map((transaction) => ({ id: transaction.id, merchant: transaction.merchant, totalPaise: transaction.amount_paise, shares: transaction.allocations.map((allocation) => ({ person: allocation.person, amountPaise: allocation.amount_paise })) })),
  };
}
