import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalOwnerContext } from "@/server/local-owner";
import { GET, POST } from "./route";

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

describe("POST /api/people", () => {
  beforeEach(() => vi.mocked(getLocalOwnerContext).mockReset());

  it("persists a new active person and returns their database ID", async () => {
    const created = { id: "navi-id", name: "Navi", is_owner: false };
    const existingSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingIlike = vi.fn(() => ({ maybeSingle: existingSingle }));
    const existingEq = vi.fn(() => ({ ilike: existingIlike }));
    const insertSingle = vi.fn().mockResolvedValue({ data: created, error: null });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));
    const client = { from: () => ({ select: () => ({ eq: existingEq }), insert }) } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await POST(new Request("http://localhost/api/people", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " Navi " }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ person: { id: "navi-id", persistedId: "navi-id", name: "Navi" } });
    expect(insert).toHaveBeenCalledWith({ user_id: "owner-1", name: "Navi", is_owner: false, is_active: true });
  });

  it("reuses an existing person case-insensitively", async () => {
    const existing = { id: "navi-id", name: "Navi", is_owner: false, is_active: true };
    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const ilike = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ ilike }));
    const insert = vi.fn();
    const client = { from: () => ({ select: () => ({ eq }), insert }) } as unknown as SupabaseClient;
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });

    const response = await POST(new Request("http://localhost/api/people", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "navi" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ person: { id: "navi-id", persistedId: "navi-id", name: "Navi" } });
    expect(insert).not.toHaveBeenCalled();
  });
});
