import { describe, expect, it } from "vitest";

import { ConfirmedExpenseSchema, ExpenseDraftSchema, rupeesToPaise } from "./expense";

describe("ExpenseDraftSchema", () => {
  it("accepts an unresolved grocery expense", () => {
    const result = ExpenseDraftSchema.parse({
      merchant: "Amazon Fresh",
      amountPaise: 248000,
      currency: "INR",
      category: "Amazon groceries",
      date: "2026-09-06",
      status: "needs_review",
      notes: "Split unknown",
    });
    expect(result.status).toBe("needs_review");
  });

  it("rejects zero-value expenses", () => {
    expect(() => ExpenseDraftSchema.parse({ merchant: "Cafe", amountPaise: 0, currency: "INR", date: "2026-09-06", status: "draft" })).toThrow();
  });

  it("converts rupees to integer paise", () => {
    expect(rupeesToPaise("1,234.56")).toBe(123456);
  });

  it("keeps validated receipt items on a confirmed expense", () => {
    const expense = ConfirmedExpenseSchema.parse({
      merchant: "Grocer", amountPaise: 1000, currency: "INR", date: "2026-09-14",
      status: "confirmed", allocations: [{ personId: "me", amountPaise: 1000 }],
      items: [{ name: "Milk", amountPaise: 1000, personal: true }],
    });

    expect(expense.items).toEqual([{ name: "Milk", amountPaise: 1000, personal: true }]);
  });
});
