import { z } from "zod";

import { ExpenseDraftSchema, type ExpenseDraft } from "@/domain/expense";
import { personNameKey } from "@/domain/person";
import { calculateAllocations, type Allocation } from "@/domain/splits";
import { resolveSplitIntent, type CatalogGroup, type ParticipantCatalog } from "./split-intent";

export const ReceiptExtractionSchema = z.object({
  merchant: z.string().trim().min(1),
  totalPaise: z.number().int().positive(),
  category: z.string().trim().min(1),
  items: z.array(z.object({
    name: z.string().trim().min(1),
    amountPaise: z.number().int().nonnegative(),
    personal: z.boolean(),
  })).min(1),
  groupName: z.string().trim().nullable(),
  participantNames: z.array(z.string().trim().min(1)).default([]),
  splitMode: z.enum(["equal", "exact", "percentage", "unresolved"]).default("unresolved"),
  shares: z.array(z.object({ personName: z.string().trim().min(1), value: z.number().nonnegative() })).default([]),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;
export type ReceiptResult = {
  draft: ExpenseDraft;
  items: ReceiptExtraction["items"];
  allocations: Allocation[];
  people: Array<{ id: string; name: string }>;
  status: "confirmed" | "needs_review";
  warning?: string;
  model: string;
  group: CatalogGroup | null;
};

export function buildReceiptResult(raw: unknown, date: string, catalog: ParticipantCatalog, model = "qwen3.5:9b-q4_K_M"): ReceiptResult {
  const receipt = ReceiptExtractionSchema.parse(raw);
  const itemTotal = receipt.items.reduce((sum, item) => sum + item.amountPaise, 0);
  const group = receipt.groupName ? catalog.groups.find((candidate) => personNameKey(candidate.name) === personNameKey(receipt.groupName!)) ?? null : null;
  const people = group?.people ?? [catalog.people.find((person) => person.id === "me") ?? { id: "me", name: "Me" }];
  const draft = ExpenseDraftSchema.parse({
    merchant: receipt.merchant,
    amountPaise: receipt.totalPaise,
    currency: "INR",
    category: receipt.category,
    date,
    status: itemTotal === receipt.totalPaise ? "draft" : "needs_review",
    notes: receipt.groupName ? `Receipt split with ${receipt.groupName}` : undefined,
    source: "ollama",
  });

  if (itemTotal !== receipt.totalPaise) {
    return {
      draft,
      items: receipt.items,
      allocations: [],
      people,
      status: "needs_review",
      warning: "The extracted items do not add up to the receipt total.",
      model,
      group,
    };
  }

  const personalPaise = receipt.items.filter((item) => item.personal).reduce((sum, item) => sum + item.amountPaise, 0);
  if (personalPaise === 0) {
    const resolved = resolveSplitIntent({
      groupName: receipt.groupName,
      participantNames: receipt.participantNames,
      mode: receipt.splitMode === "unresolved" && receipt.groupName ? "equal" : receipt.splitMode,
      shares: receipt.shares,
    }, receipt.totalPaise, catalog);
    return { draft, items: receipt.items, allocations: resolved.allocations, people: resolved.people.length ? resolved.people : people, status: resolved.status, warning: resolved.warning, model, group: resolved.group };
  }
  if (!group || people.length === 1) return { draft, items: receipt.items, allocations: [], people, status: "needs_review", warning: "Choose who should share this expense.", model, group };
  const allocation = calculateAllocations({
    mode: "shared-remainder",
    totalPaise: receipt.totalPaise,
    ownerId: "me",
    personalPaise,
    personIds: people.map((person) => person.id),
  });
  return { draft, items: receipt.items, allocations: allocation.allocations, people, status: "confirmed", model, group };
}
