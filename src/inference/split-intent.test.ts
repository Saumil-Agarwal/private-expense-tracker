import { describe, expect, it } from "vitest";

import { resolveSplitIntent, type ParticipantCatalog } from "./split-intent";

const catalog: ParticipantCatalog = {
  people: [
    { id: "me", name: "Me" },
    { id: "rahul-id", name: "Rahul" },
    { id: "priya-id", name: "Priya" },
  ],
  groups: [{ id: "group-1", name: "Flatmates", people: [{ id: "me", name: "Me" }, { id: "rahul-id", name: "Rahul" }] }],
};

describe("resolveSplitIntent", () => {
  it("selects a saved group and splits its members equally", () => {
    expect(resolveSplitIntent({ groupName: " flatmates ", participantNames: [], mode: "equal", shares: [] }, 10001, catalog)).toMatchObject({
      group: { id: "group-1" },
      selectedIds: ["me", "rahul-id"],
      allocations: [{ personId: "me", amountPaise: 5001 }, { personId: "rahul-id", amountPaise: 5000 }],
      status: "confirmed",
    });
  });

  it("selects named saved people without attaching a group", () => {
    expect(resolveSplitIntent({ groupName: null, participantNames: ["rahul", "PRIYA"], mode: "equal", shares: [] }, 12000, catalog)).toMatchObject({
      group: null,
      selectedIds: ["rahul-id", "priya-id"],
      allocations: [{ personId: "rahul-id", amountPaise: 6000 }, { personId: "priya-id", amountPaise: 6000 }],
      status: "confirmed",
    });
  });

  it("validates exact rupee shares with application arithmetic", () => {
    expect(resolveSplitIntent({ groupName: null, participantNames: ["Rahul", "Priya"], mode: "exact", shares: [{ personName: "Rahul", value: 700 }, { personName: "Priya", value: 500 }] }, 120000, catalog)).toMatchObject({
      allocations: [{ personId: "rahul-id", amountPaise: 70000 }, { personId: "priya-id", amountPaise: 50000 }],
      status: "confirmed",
    });
  });

  it("keeps recognized people selected when another name is unknown", () => {
    expect(resolveSplitIntent({ groupName: null, participantNames: ["Rahul", "Nobody"], mode: "equal", shares: [] }, 12000, catalog)).toMatchObject({
      selectedIds: ["rahul-id"], allocations: [], status: "needs_review",
    });
  });
});
