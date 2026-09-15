import { NextResponse } from "next/server";
import { z } from "zod";

import { rupeesToPaise } from "@/domain/expense";
import { buildReceiptResult } from "@/inference/receipt";
import type { ParticipantCatalog } from "@/inference/split-intent";
import { assertAllowedOutboundUrl } from "@/lib/privacy/network-policy";
import { getLocalOwnerContext } from "@/server/local-owner";

export const runtime = "nodejs";

const MODEL = process.env.OLLAMA_RECEIPT_MODEL ?? "qwen3.5:9b-q4_K_M";
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const CATEGORIES = ["Restaurants", "Uber", "Groceries", "Amazon groceries", "Internet", "Gifts", "Badminton game", "Bus", "Shows", "Flight", "Electricity", "Trip", "Activities", "Maid"];

const OllamaReceiptSchema = z.object({
  merchant: z.string().trim().min(1),
  totalRupees: z.number().positive(),
  date: z.iso.date().nullable().default(null),
  category: z.string().trim().min(1),
  items: z.array(z.object({ name: z.string().trim().min(1), amountRupees: z.number().nonnegative(), personal: z.boolean() })).min(1),
  groupName: z.string().trim().nullable(),
  participantNames: z.array(z.string().trim().min(1)).default([]),
  splitMode: z.enum(["equal", "exact", "percentage", "unresolved"]).default("unresolved"),
  shares: z.array(z.object({ personName: z.string().trim().min(1), value: z.number().nonnegative() })).default([]),
});

const receiptJsonSchema = {
  type: "object",
  properties: {
    merchant: { type: "string" },
    totalRupees: { type: "number" },
    date: { anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] },
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
    participantNames: { type: "array", items: { type: "string" } },
    splitMode: { type: "string", enum: ["equal", "exact", "percentage", "unresolved"] },
    shares: { type: "array", items: { type: "object", properties: { personName: { type: "string" }, value: { type: "number" } }, required: ["personName", "value"] } },
  },
  required: ["merchant", "totalRupees", "date", "category", "items", "groupName", "participantNames", "splitMode", "shares"],
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const images = form.getAll("images");
    const instructions = String(form.get("instructions") ?? "").trim();
    if (images.length < 1 || images.length > 10 || images.some((image) => typeof image === "string" || !("arrayBuffer" in image) || !image.type.startsWith("image/"))) {
      return NextResponse.json({ error: "Paste or choose an image receipt." }, { status: 400 });
    }
    if (images.some((image) => typeof image !== "string" && image.size > 10 * 1024 * 1024)) {
      return NextResponse.json({ error: "Receipt images must be smaller than 10 MB." }, { status: 400 });
    }

    assertAllowedOutboundUrl(OLLAMA_URL);
    const { userId, supabase } = await getLocalOwnerContext();
    const [{ data: groupRows, error: groupError }, { data: personRows, error: peopleError }] = await Promise.all([
      supabase.from("groups").select("id,name,group_members(people(id,name,is_owner))").eq("user_id", userId),
      supabase.from("people").select("id,name,is_owner").eq("user_id", userId).eq("is_active", true),
    ]);
    if (groupError || peopleError) throw groupError ?? peopleError;
    type PersonRow = { id: string; name: string; is_owner: boolean };
    type GroupRow = { id: string; name: string; group_members?: Array<{ people: PersonRow }> };
    const mapPerson = (person: PersonRow) => ({ id: person.is_owner ? "me" : person.id, persistedId: person.id, name: person.name });
    const catalog: ParticipantCatalog = {
      people: ((personRows ?? []) as PersonRow[]).map(mapPerson),
      groups: ((groupRows ?? []) as unknown as GroupRow[]).map((group) => ({ id: group.id, name: group.name, people: (group.group_members ?? []).map((member) => mapPerson(member.people)) })),
    };
    const groups = catalog.groups.map((group) => `${group.name}: ${group.people.map((person) => person.name).join(", ")}`).join("; ");
    const people = catalog.people.map((person) => person.name).join(", ");
    const prompt = [
      `Read these ${images.length} screenshot(s) as parts of one expense and return one JSON object matching the supplied schema.`,
      "Report amounts in rupees exactly as displayed, including decimals. Use final charged prices, not crossed-out list prices.",
      "Set date to the expense or transaction date visible in the screenshots in YYYY-MM-DD format. If no date is visible, set date to null.",
      "If the merchant is not visible, use Unspecified merchant; never invent one.",
      "Every purchased line item must appear exactly once. The item amounts must add up to totalRupees.",
      `Category must be one of: ${CATEGORIES.join(", ")}.`,
      "Mark personal=true only for items the user's instruction assigns exclusively to Me.",
      `Known groups: ${groups}. Set groupName to the matching group or null.`,
      `Known people: ${people}. Put explicitly named saved people in participantNames. Never invent a person.`,
      "Set splitMode to equal, exact, percentage, or unresolved. For exact shares use rupees in value; for percentage shares use percentages. Return shares as personName/value pairs.",
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
        messages: [{ role: "user", content: prompt, images: await Promise.all(images.map(async (image) => Buffer.from(await (image as File).arrayBuffer()).toString("base64"))) }],
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
      participantNames: ollamaReceipt.participantNames,
      splitMode: ollamaReceipt.splitMode,
      shares: ollamaReceipt.shares,
    };
    return NextResponse.json(buildReceiptResult(extracted, ollamaReceipt.date ?? new Date().toISOString().slice(0, 10), catalog, MODEL));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    const unavailable = /fetch failed|ECONNREFUSED|Ollama returned/.test(detail);
    return NextResponse.json({
      error: unavailable ? "Ollama is unavailable. Open the Ollama app and make sure the receipt model is installed." : `Receipt could not be interpreted: ${detail}`,
    }, { status: unavailable ? 503 : 422 });
  }
}
