import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalOwnerContext } from "@/server/local-owner";
import { POST } from "./route";

vi.mock("@/server/local-owner", () => ({ getLocalOwnerContext: vi.fn() }));

describe("POST /api/expenses", () => {
  beforeEach(() => vi.mocked(getLocalOwnerContext).mockReset());
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

  it("removes a transaction when participant persistence fails", async () => {
    const deleted: string[] = [];
    let peopleWrites = 0;
    const client = {
      from(table: string) {
        if (table === "transactions") return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: "tx-1" }, error: null }) }) }),
          delete: () => ({ eq: async (_field: string, id: string) => { deleted.push(id); return { error: null }; } }),
        };
        if (table === "people") return { upsert: () => ({ select: () => ({ single: async () => { peopleWrites += 1; return peopleWrites === 1 ? { data: { id: "me-1" }, error: null } : { data: null, error: new Error("person failed") }; } }) }) };
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });
    const request = new Request("http://localhost/api/expenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      merchant: "Dinner", amountPaise: 10000, currency: "INR", date: "2026-09-09", status: "confirmed", source: "manual",
      allocations: [{ personId: "me", amountPaise: 5000 }, { personId: "name:Rahul", amountPaise: 5000 }],
    }) });

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(deleted).toEqual(["tx-1"]);
  });
});
