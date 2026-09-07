import { z } from "zod";

export const ExpenseStatusSchema = z.enum(["draft", "needs_review", "confirmed"]);

export const AllocationSchema = z.object({
  personId: z.string().min(1),
  amountPaise: z.number().int().nonnegative(),
});

export const ExpenseDraftSchema = z.object({
  merchant: z.string().trim().min(1),
  amountPaise: z.number().int().positive(),
  currency: z.literal("INR").default("INR"),
  date: z.iso.date(),
  accountId: z.string().min(1).optional(),
  groupId: z.string().uuid().optional(),
  category: z.string().trim().min(1).optional(),
  status: ExpenseStatusSchema.default("draft"),
  notes: z.string().trim().max(1000).optional(),
  source: z.enum(["manual", "telegram", "receipt", "ollama", "on_device_model"]).default("manual"),
});

export const ConfirmedExpenseSchema = ExpenseDraftSchema.extend({
  status: z.enum(["confirmed", "needs_review"]),
  allocations: z.array(AllocationSchema),
}).superRefine((expense, context) => {
  const allocated = expense.allocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0);
  if (expense.status === "confirmed" && allocated !== expense.amountPaise) {
    context.addIssue({ code: "custom", message: "Confirmed allocations must equal the expense total", path: ["allocations"] });
  }
});

export type ExpenseDraft = z.infer<typeof ExpenseDraftSchema>;
export type ConfirmedExpense = z.infer<typeof ConfirmedExpenseSchema>;

export function rupeesToPaise(value: string | number): number {
  const normalized = typeof value === "number" ? value : Number(value.replaceAll(",", "").trim());
  if (!Number.isFinite(normalized)) throw new Error("Invalid rupee amount");
  return Math.round(normalized * 100);
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}
