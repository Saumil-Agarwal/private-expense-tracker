import { NextResponse } from "next/server";
import { z } from "zod";

import { rupeesToPaise } from "@/domain/expense";
import { buildReceiptResult, LOCAL_GROUPS } from "@/inference/receipt";
import { assertAllowedOutboundUrl } from "@/lib/privacy/network-policy";

export const runtime = "nodejs";

const MODEL = process.env.OLLAMA_RECEIPT_MODEL ?? "qwen3.5:9b-q4_K_M";
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const CATEGORIES = ["Restaurants", "Uber", "Groceries", "Amazon groceries", "Internet", "Gifts", "Badminton game", "Bus", "Shows", "Flight", "Electricity", "Trip", "Activities", "Maid"];

const OllamaReceiptSchema = z.object({
  merchant: z.string().trim().min(1),
  totalRupees: z.number().positive(),
  category: z.string().trim().min(1),
  items: z.array(z.object({ name: z.string().trim().min(1), amountRupees: z.number().nonnegative(), personal: z.boolean() })).min(1),
  groupName: z.string().trim().nullable(),
});

const receiptJsonSchema = {
  type: "object",
  properties: {
    merchant: { type: "string" },
    totalRupees: { type: "number" },
    category: { type: "string", enum: CATEGORIES },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amountRupees: { type: "number" },
          personal: { type: "boolean" },
        },
        required: ["name", "amountRupees", "personal"],
      },
    },
    groupName: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["merchant", "totalRupees", "category", "items", "groupName"],
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const instructions = String(form.get("instructions") ?? "").trim();
    if (!image || typeof image === "string" || !("arrayBuffer" in image) || !image.type.startsWith("image/")) {
      return NextResponse.json({ error: "Paste or choose an image receipt." }, { status: 400 });
    }
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Receipt images must be smaller than 10 MB." }, { status: 400 });
    }

    assertAllowedOutboundUrl(OLLAMA_URL);
    const groups = Object.entries(LOCAL_GROUPS).map(([name, people]) => `${name}: ${people.map((person) => person.name).join(", ")}`).join("; ");
    const prompt = [
      "Read this receipt image and return JSON matching the supplied schema.",
      "Report amounts in rupees exactly as displayed, including decimals. Use final charged prices, not crossed-out list prices.",
      "If the merchant is not visible, use Unspecified merchant; never invent one.",
      "Every purchased line item must appear exactly once. The item amounts must add up to totalRupees.",
      `Category must be one of: ${CATEGORIES.join(", ")}.`,
      "Mark personal=true only for items the user's instruction assigns exclusively to Me.",
      `Known groups: ${groups}. Set groupName to the matching group or null.`,
      `User instruction: ${instructions || "No special split instruction; leave groupName null."}` ,
    ].join("\n");
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        think: false,
        format: receiptJsonSchema,
        options: { temperature: 0, num_ctx: 8192 },
        messages: [{ role: "user", content: prompt, images: [Buffer.from(await image.arrayBuffer()).toString("base64")] }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const payload = await response.json() as { message?: { content?: string } };
    const ollamaReceipt = OllamaReceiptSchema.parse(JSON.parse(payload.message?.content ?? "{}"));
    const extracted = {
      merchant: ollamaReceipt.merchant,
      totalPaise: rupeesToPaise(ollamaReceipt.totalRupees),
      category: ollamaReceipt.category,
      items: ollamaReceipt.items.map((item) => ({ name: item.name, amountPaise: rupeesToPaise(item.amountRupees), personal: item.personal })),
      groupName: ollamaReceipt.groupName,
    };
    return NextResponse.json(buildReceiptResult(extracted, new Date().toISOString().slice(0, 10), MODEL));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    const unavailable = /fetch failed|ECONNREFUSED|Ollama returned/.test(detail);
    return NextResponse.json({
      error: unavailable ? "Ollama is unavailable. Open the Ollama app and make sure the receipt model is installed." : `Receipt could not be interpreted: ${detail}`,
    }, { status: unavailable ? 503 : 422 });
  }
}
