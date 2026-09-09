import { describe, expect, it } from "vitest";
import { calculateSummary } from "./summary";

describe("calculateSummary", () => {
  it("shows expense workings, participant shares, and final totals without assigning unresolved expenses", () => {
    const result = calculateSummary([
      { id: "1", merchant: "Dinner", amount_paise: 9000, status: "confirmed", allocations: [{ person: "Me", amount_paise: 3000 }, { person: "Anish", amount_paise: 6000 }] },
      { id: "2", merchant: "Cab", amount_paise: 4000, status: "confirmed", allocations: [{ person: "Anish", amount_paise: 2000 }, { person: "Sanjeev", amount_paise: 2000 }] },
      { id: "3", merchant: "Mystery", amount_paise: 1000, status: "needs_review", allocations: [] },
    ]);
    expect(result.finalTotalPaise).toBe(14000);
    expect(result.confirmedTotalPaise).toBe(13000);
    expect(result.participantTotalPaise).toBe(13000);
    expect(result.balanced).toBe(true);
    expect(result.participantTotals).toEqual([{ person: "Anish", amountPaise: 8000 }, { person: "Me", amountPaise: 3000 }, { person: "Sanjeev", amountPaise: 2000 }]);
    expect(result.unresolved).toEqual({ count: 1, amountPaise: 1000 });
    expect(result.workings[0]).toMatchObject({ allocatedPaise: 9000, differencePaise: 0, balanced: true });
    expect(result.workings[1]).toMatchObject({ allocatedPaise: 4000, differencePaise: 0, balanced: true });
    expect(result.workings[1].shares).toEqual([{ person: "Anish", amountPaise: 2000 }, { person: "Sanjeev", amountPaise: 2000 }]);
  });

  it("detects a one-paise confirmed allocation mismatch", () => {
    const result = calculateSummary([
      { id: "1", merchant: "Dinner", amount_paise: 10000, status: "confirmed", allocations: [{ person: "Me", amount_paise: 5000 }, { person: "Anish", amount_paise: 4999 }] },
    ]);

    expect(result.confirmedTotalPaise).toBe(10000);
    expect(result.participantTotalPaise).toBe(9999);
    expect(result.workings[0]).toMatchObject({ allocatedPaise: 9999, differencePaise: 1, balanced: false });
    expect(result.balanced).toBe(false);
  });
});
