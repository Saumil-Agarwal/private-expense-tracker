import { z } from "zod";

export const ExpenseStatusSchema = z.enum(["draft", "needs_review", "confirmed"]);

export const AllocationSchema = z.object({
  personId: z.string().min(1),
  amountPaise: z.number().int().nonnegative(),
});

export const ExpenseItemSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.number().positive().default(1),
  amountPaise: z.number().int().nonnegative(),
  personal: z.boolean().default(false),
});

export const EXPENSE_DATE_RANGE_MESSAGE = "Expense date must be within the last 6 months. Correct the date before saving.";

function sixMonthsAgo(referenceDate: Date): string {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth() - 6;
  const day = referenceDate.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function validateExpenseDate(expense: { date: string }, context: z.RefinementCtx) {
  if (expense.date < sixMonthsAgo(new Date())) {
    context.addIssue({ code: "custom", message: EXPENSE_DATE_RANGE_MESSAGE, path: ["date"] });
  }
}

const ExpenseDraftBaseSchema = z.object({
  merchant: z.string().trim().min(1),
  amountPaise: z.number().int().positive(),
  currency: z.literal("INR").default("INR"),
  date: z.iso.date(),
  accountId: z.string().min(1).optional(),
  groupId: z.string().uuid().optional(),
  category: z.string().trim().min(1).optional(),
  status: ExpenseStatusSchema.default("draft"),
  notes: z.string().trim().max(1000).optional(),
  source: z.enum(["manual", "receipt", "ollama", "on_device_model"]).default("manual"),
});

export const ExpenseDraftSchema = ExpenseDraftBaseSchema.superRefine(validateExpenseDate);

export const ConfirmedExpenseSchema = ExpenseDraftBaseSchema.extend({
  status: z.enum(["confirmed", "needs_review"]),
  allocations: z.array(AllocationSchema),
  items: z.array(ExpenseItemSchema).default([]),
}).superRefine((expense, context) => {
  validateExpenseDate(expense, context);
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
