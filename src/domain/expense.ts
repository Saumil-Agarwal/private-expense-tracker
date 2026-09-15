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

function sixMonthsAgo(referenceDate: Date): string {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth() - 6;
  const day = referenceDate.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function correctInferredExpenseYear(date: string, filedOn = new Date().toISOString().slice(0, 10)): { date: string; corrected: boolean } {
  if (date >= sixMonthsAgo(new Date(`${filedOn}T00:00:00Z`))) return { date, corrected: false };
  const monthAndDay = date.slice(4);
  let year = Number(filedOn.slice(0, 4));
  if (`${year}${monthAndDay}` > filedOn) year -= 1;
  const correctedDate = `${year}${monthAndDay}`;
  const parsed = new Date(`${correctedDate}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== correctedDate) return { date, corrected: false };
  return { date: correctedDate, corrected: correctedDate !== date };
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

export const ExpenseDraftSchema = ExpenseDraftBaseSchema;

export const ConfirmedExpenseSchema = ExpenseDraftBaseSchema.extend({
  status: z.enum(["confirmed", "needs_review"]),
  allocations: z.array(AllocationSchema),
  items: z.array(ExpenseItemSchema).default([]),
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
