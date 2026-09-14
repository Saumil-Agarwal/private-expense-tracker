import { afterEach, describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "./server";

const createClient = vi.hoisted(() => vi.fn(() => ({}) as never));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("createServerSupabaseClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createClient.mockClear();
  });

  it("creates the server client from the expense-scoped environment", () => {
    vi.stubEnv("EXPENSES_NEXT_PUBLIC_SUPABASE_URL", "https://expenses.example.supabase.co");
    vi.stubEnv("EXPENSES_SUPABASE_SECRET_KEY", "server-secret");

    createServerSupabaseClient();

    expect(createClient).toHaveBeenCalledWith("https://expenses.example.supabase.co", "server-secret", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
});
