import { z } from "zod";

import { ExpenseDraftSchema, type ExpenseDraft } from "@/domain/expense";
import { calculateAllocations, type Allocation } from "@/domain/splits";

export const LOCAL_GROUPS = {
  "201": [
    { id: "me", name: "Me" },
    { id: "name:Anish", name: "Anish" },
    { id: "name:Sanjeev", name: "Sanjeev" },
  ],
} as const;

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
};

export function buildReceiptResult(raw: unknown, date: string, model = "qwen3.5:9b-q4_K_M"): ReceiptResult {
  const receipt = ReceiptExtractionSchema.parse(raw);
  const itemTotal = receipt.items.reduce((sum, item) => sum + item.amountPaise, 0);
  const group = receipt.groupName && Object.hasOwn(LOCAL_GROUPS, receipt.groupName)
    ? [...LOCAL_GROUPS[receipt.groupName as keyof typeof LOCAL_GROUPS]]
    : [{ id: "me", name: "Me" }];
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

  if (itemTotal !== receipt.totalPaise || group.length === 1) {
    return {
      draft,
      items: receipt.items,
      allocations: [],
      people: group,
      status: "needs_review",
      warning: itemTotal !== receipt.totalPaise ? "The extracted items do not add up to the receipt total." : "Choose who should share this expense.",
      model,
    };
  }

  const personalPaise = receipt.items.filter((item) => item.personal).reduce((sum, item) => sum + item.amountPaise, 0);
  const allocation = calculateAllocations({
    mode: "shared-remainder",
    totalPaise: receipt.totalPaise,
    ownerId: "me",
    personalPaise,
    personIds: group.map((person) => person.id),
  });
  return { draft, items: receipt.items, allocations: allocation.allocations, people: group, status: "confirmed", model };
}
