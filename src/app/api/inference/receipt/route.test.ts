import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/inference/receipt", () => {
  it("returns a validated receipt and split from image bytes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: { content: JSON.stringify({
        merchant: "Blinkit",
        totalRupees: 104,
        category: "Groceries",
        items: [
          { name: "Parle-G Gold Biscuits", amountRupees: 10, personal: true },
          { name: "Fresh Bottle Gourd", amountRupees: 19, personal: false },
          { name: "Vedaka Tapioca Sago", amountRupees: 65, personal: false },
          { name: "Britannia Good Day Butter Cookies", amountRupees: 10, personal: true },
        ],
        groupName: "201",
      }) },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const values = new Map<string, FormDataEntryValue | { type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }>();
    values.set("image", { type: "image/png", size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    values.set("instructions", "Biscuits are for me; split the rest with 201");

    const response = await POST({ formData: async () => ({ get: (key: string) => values.get(key) ?? null }) } as unknown as Request);
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.allocations).toEqual([
      { personId: "me", amountPaise: 4800 },
      { personId: "name:Anish", amountPaise: 2800 },
      { personId: "name:Sanjeev", amountPaise: 2800 },
    ]);
    expect(body.model).toBe("qwen3.5:9b-q4_K_M");
  });
});
