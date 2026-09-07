import { describe, expect, it } from "vitest";

import { buildReceiptResult } from "./receipt";

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
      groupName: "201",
    }, "2026-09-07");

    expect(result.draft).toMatchObject({ merchant: "Blinkit", amountPaise: 10400, category: "Groceries", source: "ollama" });
    expect(result.allocations).toEqual([
      { personId: "me", amountPaise: 4800 },
      { personId: "name:Anish", amountPaise: 2800 },
      { personId: "name:Sanjeev", amountPaise: 2800 },
    ]);
  });

  it("marks a mismatched item total for review", () => {
    const result = buildReceiptResult({
      merchant: "Shop",
      totalPaise: 10400,
      category: "Groceries",
      items: [{ name: "Item", amountPaise: 1000, personal: false }],
      groupName: "201",
    }, "2026-09-07");

    expect(result.status).toBe("needs_review");
    expect(result.allocations).toEqual([]);
  });
});
