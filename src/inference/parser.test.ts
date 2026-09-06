import { describe, expect, it } from "vitest";

import { parseExpenseText } from "./parser";

describe("parseExpenseText", () => {
  it.each([
    ["₹850 at Burma Burma", "Burma Burma", 85000, "Restaurants"],
    ["Paid 2400 Amazon Fresh", "Amazon Fresh", 240000, "Amazon groceries"],
    ["Rs 1260 DMart groceries", "DMart", 126000, "Supermarkets"],
    ["Uber 475", "Uber", 47500, "Cab"],
  ])("parses %s", (text, merchant, amountPaise, category) => {
    expect(parseExpenseText(text, "2026-09-06")).toMatchObject({ merchant, amountPaise, category, currency: "INR" });
  });

  it("marks an unknown split for review", () => {
    expect(parseExpenseText("₹4200 Nature's Basket split unknown", "2026-09-06").status).toBe("needs_review");
  });

  it("does not guess when an amount is missing", () => {
    expect(() => parseExpenseText("Dinner at Bastian", "2026-09-06")).toThrow("Could not find an amount");
  });
});
