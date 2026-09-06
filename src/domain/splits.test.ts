import { describe, expect, it } from "vitest";

import { calculateAllocations } from "./splits";

describe("calculateAllocations", () => {
  it("assigns a personal expense to its owner", () => {
    expect(calculateAllocations({ mode: "personal", totalPaise: 99900, ownerId: "me" })).toEqual({
      allocations: [{ personId: "me", amountPaise: 99900 }],
      remainderPaise: 0,
      resolved: true,
    });
  });

  it("distributes equal splits deterministically to the first people", () => {
    expect(calculateAllocations({ mode: "equal", totalPaise: 10000, personIds: ["me", "a", "b"] })).toEqual({
      allocations: [
        { personId: "me", amountPaise: 3334 },
        { personId: "a", amountPaise: 3333 },
        { personId: "b", amountPaise: 3333 },
      ],
      remainderPaise: 0,
      resolved: true,
    });
  });

  it("accepts reconciled exact amounts", () => {
    expect(calculateAllocations({ mode: "exact", totalPaise: 30000, amounts: { me: 12000, a: 18000 } }).resolved).toBe(true);
  });

  it("reports a remainder for unreconciled exact amounts", () => {
    expect(calculateAllocations({ mode: "exact", totalPaise: 30000, amounts: { me: 12000 } }).remainderPaise).toBe(18000);
  });

  it("converts percentages to exact paise", () => {
    expect(calculateAllocations({ mode: "percentage", totalPaise: 12500, percentages: { me: 60, a: 40 } }).allocations).toEqual([
      { personId: "me", amountPaise: 7500 },
      { personId: "a", amountPaise: 5000 },
    ]);
  });

  it("distributes weighted shares", () => {
    expect(calculateAllocations({ mode: "weighted", totalPaise: 12000, weights: { me: 2, a: 1 } }).allocations).toEqual([
      { personId: "me", amountPaise: 8000 },
      { personId: "a", amountPaise: 4000 },
    ]);
  });

  it("adds a personal amount before sharing the remainder", () => {
    expect(calculateAllocations({ mode: "shared-remainder", totalPaise: 360000, ownerId: "me", personalPaise: 90000, personIds: ["me", "a", "b"] }).allocations).toEqual([
      { personId: "me", amountPaise: 180000 },
      { personId: "a", amountPaise: 90000 },
      { personId: "b", amountPaise: 90000 },
    ]);
  });

  it("preserves unknown allocations as unresolved", () => {
    expect(calculateAllocations({ mode: "unresolved", totalPaise: 420000 })).toEqual({
      allocations: [],
      remainderPaise: 420000,
      resolved: false,
    });
  });
});
