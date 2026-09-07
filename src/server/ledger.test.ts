import { describe, expect, it } from "vitest";

import { toTransactionInsert } from "./ledger";

describe("toTransactionInsert", () => {
  it("maps a validated expense without leaking client-only fields", () => {
    expect(toTransactionInsert("user-1", {
      merchant: "Amazon Fresh",
      amountPaise: 240000,
      currency: "INR",
      date: "2026-09-06",
      category: "Amazon groceries",
      status: "needs_review",
      source: "on_device_model",
      allocations: [],
    })).toEqual({
      user_id: "user-1",
      merchant: "Amazon Fresh",
      amount_paise: 240000,
      currency: "INR",
      occurred_on: "2026-09-06",
      status: "needs_review",
      source: "on_device_model",
      notes: null,
      group_id: null,
    });
  });
});
