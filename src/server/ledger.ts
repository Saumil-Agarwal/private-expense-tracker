import type { ConfirmedExpense } from "@/domain/expense";

export function toTransactionInsert(userId: string, expense: ConfirmedExpense) {
  return {
    user_id: userId,
    merchant: expense.merchant,
    amount_paise: expense.amountPaise,
    currency: expense.currency,
    occurred_on: expense.date,
    status: expense.status,
    source: expense.source,
    notes: expense.notes ?? null,
    group_id: expense.groupId ?? null,
  };
}
