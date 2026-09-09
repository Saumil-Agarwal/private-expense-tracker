import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/expenses", () => {
  it("returns a stable field error for a blank merchant", async () => {
    const request = new Request("http://localhost/api/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchant: "   ", amountPaise: 10000, currency: "INR", date: "2026-09-09",
        status: "confirmed", source: "manual", allocations: [{ personId: "me", amountPaise: 10000 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid expense details",
      fieldErrors: { merchant: ["Enter a merchant name"] },
    });
  });
});
