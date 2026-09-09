import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalOwnerContext } from "@/server/local-owner";
import { POST } from "./route";

vi.mock("@/server/local-owner", () => ({ getLocalOwnerContext: vi.fn() }));

function groupClient() {
  const peopleNames: string[] = [];
  const client = {
    from(table: string) {
      if (table === "groups") return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: "group-1", name: "Friends" }, error: null }) }) }) };
      if (table === "people") return { upsert: (value: { name: string }) => { peopleNames.push(value.name); return { select: () => ({ single: async () => ({ data: { id: `person-${peopleNames.length}`, name: value.name, is_owner: value.name === "Me" }, error: null }) }) }; } };
      if (table === "group_members") return { insert: async () => ({ error: null }) };
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
  return { client, peopleNames };
}

describe("POST /api/groups", () => {
  beforeEach(() => vi.mocked(getLocalOwnerContext).mockReset());

  it("creates a group without requiring Me and deduplicates names case-insensitively", async () => {
    const { client, peopleNames } = groupClient();
    vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });
    const request = new Request("http://localhost/api/groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Friends", memberNames: ["Rahul", "rahul"] }) });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(peopleNames).toEqual(["Rahul"]);
    await expect(response.json()).resolves.toMatchObject({ group: { name: "Friends", people: [{ name: "Rahul" }] } });
  });
});
