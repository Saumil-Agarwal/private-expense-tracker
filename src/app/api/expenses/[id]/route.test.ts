import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalOwnerContext } from "@/server/local-owner";
import { DELETE, GET, PATCH } from "./route";

vi.mock("@/server/local-owner", () => ({ getLocalOwnerContext: vi.fn() }));

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const query = {
    select: (...args: unknown[]) => { calls.push(["select", ...args]); return query; },
    eq: (...args: unknown[]) => { calls.push(["eq", ...args]); return query; },
    not: (...args: unknown[]) => { calls.push(["not", ...args]); return query; },
    maybeSingle: async () => result,
  };
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return {
        select: query.select,
        update: (value: unknown) => { calls.push(["update", value]); return query; },
        delete: () => { calls.push(["delete"]); return query; },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const context = { params: Promise.resolve({ id: "tx-1" }) };

describe("/api/expenses/[id]", () => {
  beforeEach(() => vi.mocked(getLocalOwnerContext).mockReset());

  it("returns owner-scoped expense details with items and allocations", async () => {
    const { client, calls } = fakeClient({ data: {
      id: "tx-1", merchant: "Grocer", occurred_on: "2026-09-14", amount_paise: 1000, currency: "INR", status: "confirmed", notes: "Weekly shop", source: "receipt", deleted_at: null,
      categories: { name: "Groceries" }, groups: null,
      allocations: [{ amount_paise: 1000, people: { name: "Me" } }],
      transaction_items: [{ id: "item-1", name: "Milk", quantity: 1, amount_paise: 1000, people: { name: "Me" } }],
    }, error: null });
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await GET(new Request("http://localhost/api/expenses/tx-1"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ expense: {
      id: "tx-1", allocations: [{ person: "Me", amount_paise: 1000 }],
      items: [{ id: "item-1", name: "Milk", quantity: 1, amount_paise: 1000, owner: "Me" }],
    } });
    expect(calls).toContainEqual(["eq", "user_id", "owner-1"]);
  });

  it.each([
    ["trash", expect.objectContaining({ deleted_at: expect.any(String) })],
    ["restore", { deleted_at: null }],
  ])("%s updates only the owner's expense", async (action, expectedUpdate) => {
    const { client, calls } = fakeClient({ data: { id: "tx-1" }, error: null });
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await PATCH(new Request("http://localhost/api/expenses/tx-1", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }), context);

    expect(response.status).toBe(200);
    expect(calls).toContainEqual(["update", expectedUpdate]);
    expect(calls).toContainEqual(["eq", "user_id", "owner-1"]);
  });

  it("updates every editable expense field through one owner-scoped database call", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "tx-1", error: null });
    const client = { rpc } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });
    const expense = {
      merchant: "Updated market", amountPaise: 18750, currency: "INR", date: "2026-09-15",
      category: "Groceries", groupId: "11111111-1111-4111-8111-111111111111", notes: "Monthly shop",
      status: "confirmed", source: "receipt",
      allocations: [{ personId: "person-1", amountPaise: 18750 }],
      items: [{ name: "Rice", quantity: 2, amountPaise: 18750, personal: true }],
    };

    const response = await PATCH(new Request("http://localhost/api/expenses/tx-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(expense),
    }), context);

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("update_expense", {
      p_transaction_id: "tx-1", p_user_id: "owner-1", p_expense: expense,
    });
  });

  it("permanently deletes only an already-trashed owner-scoped expense", async () => {
    const { client, calls } = fakeClient({ data: { id: "tx-1" }, error: null });
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await DELETE(new Request("http://localhost/api/expenses/tx-1", { method: "DELETE" }), context);

    expect(response.status).toBe(204);
    expect(calls).toContainEqual(["eq", "user_id", "owner-1"]);
    expect(calls).toContainEqual(["not", "deleted_at", "is", null]);
  });
});
