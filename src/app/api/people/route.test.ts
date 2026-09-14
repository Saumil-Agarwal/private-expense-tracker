import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalOwnerContext } from "@/server/local-owner";
import { GET } from "./route";

vi.mock("@/server/local-owner", () => ({ getLocalOwnerContext: vi.fn() }));

describe("GET /api/people", () => {
  beforeEach(() => vi.mocked(getLocalOwnerContext).mockReset());

  it("returns saved people with a stable owner ID", async () => {
    const rows = [
      { id: "owner-person", name: "Me", is_owner: true },
      { id: "rahul-id", name: "Rahul", is_owner: false },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eqActive = vi.fn(() => ({ order }));
    const eqUser = vi.fn(() => ({ eq: eqActive }));
    const client = { from: () => ({ select: () => ({ eq: eqUser }) }) } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ people: [
      { id: "me", persistedId: "owner-person", name: "Me" },
      { id: "rahul-id", persistedId: "rahul-id", name: "Rahul" },
    ] });
  });
});
