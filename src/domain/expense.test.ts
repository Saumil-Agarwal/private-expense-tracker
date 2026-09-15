import { describe, expect, it } from "vitest";

import { ConfirmedExpenseSchema, correctInferredExpenseYear, ExpenseDraftSchema, rupeesToPaise } from "./expense";

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

  it("allows a manually entered historical expense date", () => {
    const result = ExpenseDraftSchema.safeParse({ merchant: "Cafe", amountPaise: 1000, currency: "INR", date: "2024-08-07", status: "draft" });

    expect(result.success).toBe(true);
  });

  it("replaces an implausible inferred year with the current year", () => {
    expect(correctInferredExpenseYear("2024-08-07", "2026-09-15")).toEqual({ date: "2026-08-07", corrected: true });
  });

  it("uses the previous year when the current-year date would be in the future", () => {
    expect(correctInferredExpenseYear("2023-12-07", "2026-01-15")).toEqual({ date: "2025-12-07", corrected: true });
  });

  it("leaves a plausible inferred date unchanged", () => {
    expect(correctInferredExpenseYear("2026-08-07", "2026-09-15")).toEqual({ date: "2026-08-07", corrected: false });
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

    expect(expense.items).toEqual([{ name: "Milk", quantity: 1, amountPaise: 1000, personal: true }]);
  });
});
