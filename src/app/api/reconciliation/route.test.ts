import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalOwnerContext } from "@/server/local-owner";
import { PATCH, POST } from "./route";

vi.mock("@/server/local-owner", () => ({ getLocalOwnerContext: vi.fn() }));

describe("/api/reconciliation", () => {
  beforeEach(() => vi.mocked(getLocalOwnerContext).mockReset());

  it("upserts a payment source checkpoint", async () => {
    const writes: unknown[] = [];
    const client = { from: () => ({ upsert: async (value: unknown) => { writes.push(value); return { error: null }; } }) } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await PATCH(new Request("http://localhost/api/reconciliation", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceKey: "axis-7461", enteredThrough: "2026-09-15" }),
    }));

    expect(response.status).toBe(200);
    expect(writes).toEqual([{ user_id: "owner-1", source_key: "axis-7461", entered_through: "2026-09-15" }]);
  });

  it("records that a participant was informed", async () => {
    const writes: unknown[] = [];
    const client = { from: () => ({ upsert: async (value: unknown) => { writes.push(value); return { error: null }; } }) } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await POST(new Request("http://localhost/api/reconciliation", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ personId: "11111111-1111-4111-8111-111111111111" }),
    }));

    expect(response.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ user_id: "owner-1", person_id: "11111111-1111-4111-8111-111111111111" });
    expect((writes[0] as { informed_at: string }).informed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
