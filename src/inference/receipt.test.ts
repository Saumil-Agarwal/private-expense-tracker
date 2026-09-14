import { describe, expect, it } from "vitest";

import { buildReceiptResult } from "./receipt";

const catalog = {
  people: [{ id: "me", name: "Me" }, { id: "anish-id", name: "Anish" }, { id: "sanjeev-id", name: "Sanjeev" }, { id: "rahul-id", name: "Rahul" }, { id: "priya-id", name: "Priya" }],
  groups: [{ id: "11111111-1111-4111-8111-111111111111", name: "Flatmates", people: [{ id: "me", name: "Me" }, { id: "anish-id", name: "Anish" }, { id: "sanjeev-id", name: "Sanjeev" }] }],
};

describe("buildReceiptResult", () => {
  it("adds personal items to the owner's equal share of the group remainder", () => {
    const result = buildReceiptResult({
      merchant: "Blinkit",
      totalPaise: 10400,
      category: "Groceries",
      items: [
        { name: "Parle-G Gold Biscuits", amountPaise: 1000, personal: true },
        { name: "Fresh Bottle Gourd", amountPaise: 1900, personal: false },
        { name: "Vedaka Tapioca Sago", amountPaise: 6500, personal: false },
        { name: "Britannia Good Day Butter Cookies", amountPaise: 1000, personal: true },
      ],
      groupName: "Flatmates",
    }, "2026-09-07", catalog);

    expect(result.draft).toMatchObject({ merchant: "Blinkit", amountPaise: 10400, category: "Groceries", source: "ollama" });
    expect(result.allocations).toEqual([
      { personId: "me", amountPaise: 4800 },
      { personId: "anish-id", amountPaise: 2800 },
      { personId: "sanjeev-id", amountPaise: 2800 },
    ]);
    expect(result.group).toMatchObject({ id: "11111111-1111-4111-8111-111111111111", name: "Flatmates" });
  });

  it("marks a mismatched item total for review", () => {
    const result = buildReceiptResult({
      merchant: "Shop",
      totalPaise: 10400,
      category: "Groceries",
      items: [{ name: "Item", amountPaise: 1000, personal: false }],
      groupName: "Flatmates",
    }, "2026-09-07", catalog);

    expect(result.status).toBe("needs_review");
    expect(result.allocations).toEqual([]);
  });

  it("splits a receipt among named saved people without a group", () => {
    const result = buildReceiptResult({
      merchant: "Cafe", totalPaise: 12000, category: "Restaurants",
      items: [{ name: "Meal", amountPaise: 12000, personal: false }],
      groupName: null, participantNames: ["Rahul", "Priya"], splitMode: "equal", shares: [],
    }, "2026-09-14", catalog);

    expect(result.group).toBeNull();
    expect(result.allocations).toEqual([{ personId: "rahul-id", amountPaise: 6000 }, { personId: "priya-id", amountPaise: 6000 }]);
    expect(result.status).toBe("confirmed");
  });

  it("adds personal items to Me while sharing the remainder with named people", () => {
    const result = buildReceiptResult({
      merchant: "Cafe", totalPaise: 12000, category: "Restaurants",
      items: [{ name: "Mine", amountPaise: 2000, personal: true }, { name: "Shared", amountPaise: 10000, personal: false }],
      groupName: null, participantNames: ["Rahul", "Priya"], splitMode: "equal", shares: [],
    }, "2026-09-14", catalog);

    expect(result.allocations).toEqual([
      { personId: "me", amountPaise: 5334 }, { personId: "rahul-id", amountPaise: 3333 }, { personId: "priya-id", amountPaise: 3333 },
    ]);
    expect(result.status).toBe("confirmed");
  });
});
