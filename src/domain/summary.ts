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
  let confirmedTotalPaise = 0;
  for (const transaction of transactions) {
    if (transaction.status === "needs_review") {
      unresolvedCount += 1;
      unresolvedAmount += transaction.amount_paise;
      continue;
    }
    confirmedTotalPaise += transaction.amount_paise;
    for (const allocation of transaction.allocations) totals.set(allocation.person, (totals.get(allocation.person) ?? 0) + allocation.amount_paise);
  }
  const participantTotalPaise = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  const workings = transactions.map((transaction) => {
    const allocatedPaise = transaction.allocations.reduce((sum, allocation) => sum + allocation.amount_paise, 0);
    const differencePaise = transaction.status === "confirmed" ? transaction.amount_paise - allocatedPaise : 0;
    return {
      id: transaction.id,
      merchant: transaction.merchant,
      totalPaise: transaction.amount_paise,
      shares: transaction.allocations.map((allocation) => ({ person: allocation.person, amountPaise: allocation.amount_paise })),
      allocatedPaise,
      differencePaise,
      balanced: transaction.status === "confirmed" ? differencePaise === 0 : null,
    };
  });
  return {
    finalTotalPaise: transactions.reduce((sum, transaction) => sum + transaction.amount_paise, 0),
    confirmedTotalPaise,
    participantTotalPaise,
    balanced: confirmedTotalPaise === participantTotalPaise && workings.every((working) => working.balanced !== false),
    unresolved: { count: unresolvedCount, amountPaise: unresolvedAmount },
    participantTotals: [...totals].map(([person, amountPaise]) => ({ person, amountPaise })).sort((a, b) => b.amountPaise - a.amountPaise || a.person.localeCompare(b.person)),
    workings,
  };
}
