import { describe, expect, it } from "vitest";

import { parseExpenseInstruction, parseExpenseText } from "./parser";

const catalog = {
  people: [{ id: "me", name: "Me" }, { id: "rahul-id", name: "Rahul" }, { id: "priya-id", name: "Priya" }],
  groups: [{ id: "group-1", name: "Flatmates", people: [{ id: "me", name: "Me" }, { id: "rahul-id", name: "Rahul" }] }],
};

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

  it("infers an equal split with named saved people", () => {
    expect(parseExpenseInstruction("Dinner ₹1200 with Rahul and Priya, split equally", "2026-09-14", catalog).splitIntent).toEqual({
      groupName: null, participantNames: ["Rahul", "Priya"], mode: "equal", shares: [],
    });
  });

  it("infers a named saved group", () => {
    const result = parseExpenseInstruction("Taxi ₹900 split with flatmates", "2026-09-14", catalog);
    expect(result.draft.merchant).toBe("Taxi");
    expect(result.splitIntent).toEqual({
      groupName: "Flatmates", participantNames: [], mode: "equal", shares: [],
    });
  });

  it("infers exact rupee shares for saved people", () => {
    expect(parseExpenseInstruction("Dinner ₹1200; Rahul ₹700, Priya ₹500", "2026-09-14", catalog).splitIntent).toEqual({
      groupName: null, participantNames: ["Rahul", "Priya"], mode: "exact",
      shares: [{ personName: "Rahul", value: 700 }, { personName: "Priya", value: 500 }],
    });
  });
});
