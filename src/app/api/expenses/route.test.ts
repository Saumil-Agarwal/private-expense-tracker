import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalOwnerContext } from "@/server/local-owner";
import { GET, POST } from "./route";

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

  it("persists receipt items with the transaction", async () => {
    const itemRows: unknown[] = [];
    const client = {
      from(table: string) {
        if (table === "transactions") return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: "tx-1" }, error: null }) }) }),
          delete: () => ({ eq: async () => ({ error: null }) }),
        };
        if (table === "transaction_items") return { insert: async (rows: unknown[]) => { itemRows.push(...rows); return { error: null }; } };
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await POST(new Request("http://localhost/api/expenses", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        merchant: "Grocer", amountPaise: 1000, currency: "INR", date: "2026-09-14", status: "needs_review", source: "receipt", allocations: [],
        items: [{ name: "Milk", amountPaise: 1000, personal: false }],
      }),
    }));

    expect(response.status).toBe(201);
    expect(itemRows).toEqual([{ user_id: "owner-1", transaction_id: "tx-1", name: "Milk", quantity: 1, amount_paise: 1000, owner_person_id: null }]);
  });

  it.each([
    ["http://localhost/api/expenses", ["is", "deleted_at", null]],
    ["http://localhost/api/expenses?trash=true", ["not", "deleted_at", "is", null]],
  ] as const)("scopes list visibility for %s", async (url, expectedFilter) => {
    const filters: unknown[][] = [];
    const query = {
      eq: (...args: unknown[]) => { filters.push(["eq", ...args]); return query; },
      is: (...args: unknown[]) => { filters.push(["is", ...args]); return query; },
      not: (...args: unknown[]) => { filters.push(["not", ...args]); return query; },
      order: () => query,
      limit: () => query,
      then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
    };
    const client = { from: () => ({ select: () => query }) } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await GET(new Request(url));

    expect(response.status).toBe(200);
    expect(filters).toContainEqual(expectedFilter);
    expect(filters).toContainEqual(["eq", "user_id", "owner-1"]);
  });

  it("orders the most recently added expense first", async () => {
    const orders: unknown[][] = [];
    const query = {
      eq: () => query,
      is: () => query,
      order: (...args: unknown[]) => { orders.push(args); return query; },
      limit: () => query,
      then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
    };
    const client = { from: () => ({ select: () => query }) } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    await GET(new Request("http://localhost/api/expenses"));

    expect(orders[0]).toEqual(["created_at", { ascending: false }]);
  });
});
