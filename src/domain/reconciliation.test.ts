import { describe, expect, it } from "vitest";

import { calculateCommonThroughDate, calculateOutstandingShares } from "./reconciliation";

describe("calculateCommonThroughDate", () => {
  it("returns no common date while any payment source is incomplete", () => {
    expect(calculateCommonThroughDate([
      { key: "cash", enteredThrough: "2026-09-15" },
      { key: "axis-7461", enteredThrough: null },
    ])).toBeNull();
  });

  it("uses the earliest completed source date", () => {
    expect(calculateCommonThroughDate([
      { key: "cash", enteredThrough: "2026-09-15" },
      { key: "axis-7461", enteredThrough: "2026-09-12" },
    ])).toBe("2026-09-12");
  });
});

describe("calculateOutstandingShares", () => {
  const transactions = [
    {
      id: "old",
      created_at: "2026-09-10T10:00:00.000Z",
      occurred_on: "2026-09-10",
      status: "confirmed" as const,
      allocations: [{ personId: "person-1", person: "Anish", amount_paise: 4000 }],
    },
    {
      id: "new-backdated",
      created_at: "2026-09-16T10:00:00.000Z",
      occurred_on: "2026-08-01",
      status: "confirmed" as const,
      allocations: [{ personId: "person-1", person: "Anish", amount_paise: 2500 }],
    },
  ];

  it("shows only expenses entered after the person was informed", () => {
    expect(calculateOutstandingShares(transactions, { "person-1": "2026-09-15T10:00:00.000Z" })).toEqual([
      { personId: "person-1", person: "Anish", amountPaise: 2500 },
    ]);
  });

  it("hides a person when no expense was entered after notification", () => {
    expect(calculateOutstandingShares(transactions.slice(0, 1), { "person-1": "2026-09-15T10:00:00.000Z" })).toEqual([]);
  });
});
