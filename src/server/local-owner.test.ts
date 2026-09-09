import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getLocalOwnerContext } from "./local-owner";

type Result = { data: { id: string } | null; error: { code?: string } | null };

function fakeClient(reads: Result[], insert: Result) {
  const state = { reads: 0, inserts: 0 };
  const client = {
    from(table: string) {
      expect(table).toBe("profiles");
      return {
        select() {
          return { eq() { return { maybeSingle: async () => reads[state.reads++] }; } };
        },
        insert(value: unknown) {
          expect(value).toEqual({ profile_key: "local-owner", display_name: "Owner" });
          state.inserts += 1;
          return { select() { return { single: async () => insert }; } };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, state };
}

describe("getLocalOwnerContext", () => {
  it("returns the existing stable local owner", async () => {
    const { client, state } = fakeClient([{ data: { id: "owner-1" }, error: null }], { data: null, error: null });
    await expect(getLocalOwnerContext(client)).resolves.toMatchObject({ userId: "owner-1", supabase: client });
    expect(state.inserts).toBe(0);
  });

  it("creates the local owner when it is missing", async () => {
    const { client, state } = fakeClient([{ data: null, error: null }], { data: { id: "owner-2" }, error: null });
    await expect(getLocalOwnerContext(client)).resolves.toMatchObject({ userId: "owner-2" });
    expect(state.inserts).toBe(1);
  });

  it("re-reads after a concurrent creator wins", async () => {
    const { client, state } = fakeClient([
      { data: null, error: null },
      { data: { id: "owner-3" }, error: null },
    ], { data: null, error: { code: "23505" } });
    await expect(getLocalOwnerContext(client)).resolves.toMatchObject({ userId: "owner-3" });
    expect(state.inserts).toBe(1);
  });
});
