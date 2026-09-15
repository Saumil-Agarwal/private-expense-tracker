import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalOwnerContext } from "@/server/local-owner";
import { POST } from "./route";

vi.mock("@/server/local-owner", () => ({ getLocalOwnerContext: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  const client = { from(table: string) {
    const data = table === "groups"
      ? [{ id: "11111111-1111-4111-8111-111111111111", name: "Flatmates", group_members: [{ people: { id: "owner-person", name: "Me", is_owner: true } }, { people: { id: "anish-id", name: "Anish", is_owner: false } }, { people: { id: "sanjeev-id", name: "Sanjeev", is_owner: false } }] }]
      : [{ id: "owner-person", name: "Me", is_owner: true }, { id: "anish-id", name: "Anish", is_owner: false }, { id: "sanjeev-id", name: "Sanjeev", is_owner: false }];
    return table === "people"
      ? { select: () => ({ eq: () => ({ eq: async () => ({ data, error: null }) }) }) }
      : { select: () => ({ eq: async () => ({ data, error: null }) }) };
  } } as unknown as SupabaseClient;
  vi.mocked(getLocalOwnerContext).mockResolvedValue({ userId: "owner-1", supabase: client });
});

describe("POST /api/inference/receipt", () => {
  it("returns a validated receipt and split from image bytes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: { content: JSON.stringify({
        merchant: "Blinkit",
        totalRupees: 104,
        date: "2026-09-07",
        category: "Groceries",
        items: [
          { name: "Parle-G Gold Biscuits", amountRupees: 10, personal: true },
          { name: "Fresh Bottle Gourd", amountRupees: 19, personal: false },
          { name: "Vedaka Tapioca Sago", amountRupees: 65, personal: false },
          { name: "Britannia Good Day Butter Cookies", amountRupees: 10, personal: true },
        ],
        groupName: "Flatmates",
      }) },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const values = new Map<string, FormDataEntryValue | { type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }>();
    values.set("images", { type: "image/png", size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    values.set("instructions", "Biscuits are for me; split the rest with 201");

    const response = await POST({ formData: async () => ({
      get: (key: string) => values.get(key) ?? null,
      getAll: (key: string) => key === "images" ? [values.get("images")!] : [],
    }) } as unknown as Request);
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.allocations).toEqual([
      { personId: "me", amountPaise: 4800 },
      { personId: "anish-id", amountPaise: 2800 },
      { personId: "sanjeev-id", amountPaise: 2800 },
    ]);
    expect(body.group.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.draft.date).toBe("2026-09-07");
    expect(body.model).toBe("qwen3.5:9b-q4_K_M");
    const ollamaRequest = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(ollamaRequest.messages[0].images).toHaveLength(1);
    expect(ollamaRequest.messages[0].content).toContain("Flatmates: Me, Anish, Sanjeev");
    expect(ollamaRequest.messages[0].content).not.toContain("anish-id");
    expect(ollamaRequest.messages[0].content).toContain("participantNames");
    expect(ollamaRequest.messages[0].content).toContain("date visible in the screenshots");
    expect(ollamaRequest.format.properties).toHaveProperty("date");
    expect(ollamaRequest.format.properties).toHaveProperty("splitMode");
  });

  it("sends every queued screenshot to Ollama as one request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: JSON.stringify({
      merchant: "Combined", totalRupees: 100, category: "Groceries",
      items: [{ name: "Total", amountRupees: 100, personal: false }], groupName: null,
    }) } }), { status: 200 })));
    const images = [1, 2].map((value) => ({ type: "image/png", size: 1, arrayBuffer: async () => new Uint8Array([value]).buffer }));
    const response = await POST({ formData: async () => ({ get: () => "", getAll: () => images }) } as unknown as Request);
    expect(response.status).toBe(200);
    const ollamaRequest = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(ollamaRequest.messages[0].images).toHaveLength(2);
  });
});
